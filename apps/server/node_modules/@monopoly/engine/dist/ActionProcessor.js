// =============================================================================
// engine/ActionProcessor.ts
// Central action validation and dispatch.
//
// Design:
// - Two registries: validators and handlers, keyed by ActionType.
// - validate() runs the validator — never throws on validation failure.
// - apply() runs the handler — throws EngineNotImplementedError for TODO stubs.
// - actingPlayerId is the JWT-verified player ID passed from SocketData.
//   It is never taken from the action payload.
// =============================================================================
import { ActionType, ErrorCode, GamePhase, TurnPhase, EventType, JailReason, DecisionType, TileType, } from '@monopoly/shared';
;
import { EngineValidationError, EngineNotImplementedError, EngineStateCorruptionError } from './errors.js';
import { TileResolver } from './TileResolver.js';
import { DiceEngine } from './DiceEngine.js';
import { AuctionEngine } from './AuctionEngine.js';
import { CardEngine } from './CardEngine.js';
import { canManageProperties } from './utils/PhaseUtils.js';
import { PropertyTransactionPlanner } from './PropertyTransactionPlanner.js';
import { PropertyManagementEngine } from './PropertyManagementEngine.js';
import { MortgagePlanner } from './MortgagePlanner.js';
import { MortgageEngine } from './MortgageEngine.js';
import { BankruptcyPlanner } from './BankruptcyPlanner.js';
import { BankruptcyEngine } from './BankruptcyEngine.js';
import { DebtResolutionEngine } from './DebtResolutionEngine.js';
// ---------------------------------------------------------------------------
// ActionProcessor
// ---------------------------------------------------------------------------
/**
 * Validates and dispatches client actions to their handler functions.
 *
 * Pipeline position: receives action AFTER auth middleware, BEFORE state persistence.
 * Does NOT read from Redis; receives the already-loaded GameState as a parameter.
 *
 * ### Auth contract
 * `actingPlayerId` is provided by the server's Socket.IO middleware, extracted
 * from the verified JWT. It is NEVER derived from the action payload.
 */
export class ActionProcessor {
    stateMachine;
    validators = new Map();
    handlers = new Map();
    tileResolver;
    cardEngine;
    auctionEngine = new AuctionEngine();
    /**
     * @param stateMachine       Shared StateMachine instance from GameEngine.
     * @param customTileHandlers Optional map of tile-ID → handler for CUSTOM tiles.
     *                           Pass at game-start if the map has CUSTOM tile types.
     */
    constructor(stateMachine, customTileHandlers) {
        this.stateMachine = stateMachine;
        this.tileResolver = new TileResolver(customTileHandlers);
        this.cardEngine = new CardEngine();
        this.registerValidators();
        this.registerHandlers();
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    /**
     * Validate an action against the current state.
     * Returns ValidationResult — does NOT throw on validation failure.
     *
     * @param state        Current authoritative game state.
     * @param action       Client-submitted action.
     * @param mapConfig    Loaded map configuration for this game.
     * @param actingPlayerId JWT-verified player performing this action.
     */
    validate(state, action, mapConfig, actingPlayerId) {
        const validator = this.validators.get(action.type);
        if (!validator) {
            return {
                valid: false,
                reason: `No validator registered for action type '${action.type}'.`,
                code: ErrorCode.E_UNKNOWN,
            };
        }
        try {
            return validator(state, action, mapConfig, actingPlayerId);
        }
        catch (err) {
            if (err instanceof EngineValidationError) {
                return { valid: false, reason: err.message, code: err.code };
            }
            throw err;
        }
    }
    /**
     * Apply a previously validated action to the state.
     * Returns the new state and emitted events.
     *
     * IMPORTANT: Only call this AFTER validate() returns { valid: true }.
     * @throws {EngineNotImplementedError} for TODO stub handlers.
     * @throws {EngineValidationError} if a handler detects a late-breaking conflict.
     */
    apply(state, action, mapConfig, actingPlayerId) {
        const handler = this.handlers.get(action.type);
        if (!handler) {
            throw new Error(`[ACTION_PROCESSOR] No handler registered for '${action.type}'.`);
        }
        return handler(state, action, mapConfig, actingPlayerId);
    }
    // -------------------------------------------------------------------------
    // Validator Registration
    // -------------------------------------------------------------------------
    registerValidators() {
        // Lobby
        this.validators.set(ActionType.ROOM_READY, this.validateRoomReady.bind(this));
        this.validators.set(ActionType.ROOM_SETTINGS_UPDATE, this.validateRoomSettingsUpdate.bind(this));
        this.validators.set(ActionType.ROOM_START_GAME, this.validateRoomStartGame.bind(this));
        // Turn core
        this.validators.set(ActionType.ROLL_DICE, this.validateRollDice.bind(this));
        this.validators.set(ActionType.BUY_PROPERTY, this.validateBuyProperty.bind(this));
        this.validators.set(ActionType.DECLINE_PROPERTY, this.validateDeclineProperty.bind(this));
        this.validators.set(ActionType.END_TURN, this.validateEndTurn.bind(this));
        this.validators.set(ActionType.APPLY_CARD, this.validateApplyCard.bind(this));
        // Jail
        this.validators.set(ActionType.PAY_JAIL_FINE, this.validatePayJailFine.bind(this));
        this.validators.set(ActionType.USE_JAIL_CARD, this.validateUseJailCard.bind(this));
        this.validators.set(ActionType.ROLL_FOR_DOUBLES, this.validateRollForDoubles.bind(this));
        // Property management
        this.validators.set(ActionType.BUILD_HOUSE, this.validateBuildHouse.bind(this));
        this.validators.set(ActionType.BUILD_HOTEL, this.validateBuildHotel.bind(this));
        this.validators.set(ActionType.SELL_HOUSE, this.validateSellHouse.bind(this));
        this.validators.set(ActionType.SELL_HOTEL, this.validateSellHotel.bind(this));
        this.validators.set(ActionType.MORTGAGE_PROPERTY, this.validateMortgageProperty.bind(this));
        this.validators.set(ActionType.UNMORTGAGE_PROPERTY, this.validateUnmortgageProperty.bind(this));
        // Auction
        this.validators.set(ActionType.PLACE_BID, this.validatePlaceBid.bind(this));
        this.validators.set(ActionType.AUCTION_FOLD, this.validateAuctionFold.bind(this));
        // Trade
        this.validators.set(ActionType.TRADE_PROPOSE, this.validateTradePropose.bind(this));
        this.validators.set(ActionType.TRADE_ACCEPT, this.validateTradeAccept.bind(this));
        this.validators.set(ActionType.TRADE_REJECT, this.validateTradeReject.bind(this));
        this.validators.set(ActionType.TRADE_COUNTER, this.validateTradeCounter.bind(this));
        this.validators.set(ActionType.TRADE_CANCEL, this.validateTradeCancel.bind(this));
        // System
        this.validators.set(ActionType.REQUEST_FULL_STATE, this.validateRequestFullState.bind(this));
        // Bankruptcy
        this.validators.set(ActionType.DECLARE_BANKRUPTCY, this.validateDeclareBankruptcy.bind(this));
    }
    // -------------------------------------------------------------------------
    // Handler Registration
    // -------------------------------------------------------------------------
    registerHandlers() {
        // Lobby
        this.handlers.set(ActionType.ROOM_READY, this.handleRoomReady.bind(this));
        this.handlers.set(ActionType.ROOM_SETTINGS_UPDATE, this.handleRoomSettingsUpdate.bind(this));
        this.handlers.set(ActionType.ROOM_START_GAME, this.handleRoomStartGame.bind(this));
        // Turn core
        this.handlers.set(ActionType.ROLL_DICE, this.handleRollDice.bind(this));
        this.handlers.set(ActionType.BUY_PROPERTY, this.handleBuyProperty.bind(this));
        this.handlers.set(ActionType.DECLINE_PROPERTY, this.handleDeclineProperty.bind(this));
        this.handlers.set(ActionType.END_TURN, this.handleEndTurn.bind(this));
        this.handlers.set(ActionType.APPLY_CARD, this.handleApplyCard.bind(this));
        // Jail
        this.handlers.set(ActionType.PAY_JAIL_FINE, this.handlePayJailFine.bind(this));
        this.handlers.set(ActionType.USE_JAIL_CARD, this.handleUseJailCard.bind(this));
        this.handlers.set(ActionType.ROLL_FOR_DOUBLES, this.handleRollForDoubles.bind(this));
        // Property management
        this.handlers.set(ActionType.BUILD_HOUSE, this.handleBuildHouse.bind(this));
        this.handlers.set(ActionType.BUILD_HOTEL, this.handleBuildHotel.bind(this));
        this.handlers.set(ActionType.SELL_HOUSE, this.handleSellHouse.bind(this));
        this.handlers.set(ActionType.SELL_HOTEL, this.handleSellHotel.bind(this));
        this.handlers.set(ActionType.MORTGAGE_PROPERTY, this.handleMortgageProperty.bind(this));
        this.handlers.set(ActionType.UNMORTGAGE_PROPERTY, this.handleUnmortgageProperty.bind(this));
        // Auction
        this.handlers.set(ActionType.PLACE_BID, this.handlePlaceBid.bind(this));
        this.handlers.set(ActionType.AUCTION_FOLD, this.handleAuctionFold.bind(this));
        // Trade
        this.handlers.set(ActionType.TRADE_PROPOSE, this.handleTradePropose.bind(this));
        this.handlers.set(ActionType.TRADE_ACCEPT, this.handleTradeAccept.bind(this));
        this.handlers.set(ActionType.TRADE_REJECT, this.handleTradeReject.bind(this));
        this.handlers.set(ActionType.TRADE_COUNTER, this.handleTradeCounter.bind(this));
        this.handlers.set(ActionType.TRADE_CANCEL, this.handleTradeCancel.bind(this));
        // System
        this.handlers.set(ActionType.REQUEST_FULL_STATE, this.handleRequestFullState.bind(this));
        // Bankruptcy
        this.handlers.set(ActionType.DECLARE_BANKRUPTCY, this.handleDeclareBankruptcy.bind(this));
    }
    // =========================================================================
    //  ROLL_DICE — Fully Implemented
    // =========================================================================
    validateRollDice(state, _action, _config, actingPlayerId) {
        if (state.phase !== GamePhase.IN_PROGRESS) {
            return fail(ErrorCode.E_GAME_NOT_STARTED, 'Game is not in progress.');
        }
        if (state.turn.currentPlayerId !== actingPlayerId) {
            return fail(ErrorCode.E_NOT_YOUR_TURN, `It is not your turn. Current player: '${state.turn.currentPlayerId}'.`);
        }
        if (state.turn.phase !== TurnPhase.PRE_ROLL) {
            return fail(ErrorCode.E_INVALID_PHASE, `Cannot roll dice in turn phase '${state.turn.phase}'. Expected PRE_ROLL.`);
        }
        return ok();
    }
    /**
     * Roll the dice, move the player, and handle all movement effects.
     *
     * Pipeline:
     *  1. Roll two dice using the PRNG — advances rngState deterministically.
     *  2. Track consecutive doubles. On the 3rd: jail the player and exit early.
     *  3. Compute new position (position + total) % board.size.
     *  4. Detect passing GO — award salary exactly once.
     *  5. Move the player.
     *  6. Advance TurnPhase to ROLLED.
     *  7. Delegate to resolveLandingTile() (stub → POST_ROLL).
     *  8. Return { newState, events }.
     *
     * Event order (normal): DICE_ROLLED → [PLAYER_PASSED_GO] → PLAYER_MOVED.
     * Event order (jail):   DICE_ROLLED → PLAYER_JAILED.
     */
    handleRollDice(state, action, config, actingPlayerId) {
        const player = state.players[actingPlayerId];
        if (!player) {
            throw new EngineStateCorruptionError(`handleRollDice: player '${actingPlayerId}' not found in state.players`);
        }
        // ------------------------------------------------------------------
        // 1. Roll dice
        // ------------------------------------------------------------------
        const rollResult = DiceEngine.rollTwoDice(state.rngState);
        const { dice, total, isDoubles, nextRngState } = rollResult;
        const newConsecutiveDoubles = isDoubles ? state.turn.consecutiveDoubles + 1 : 0;
        const diceRolledEvent = ActionProcessor.buildDiceRolledEvent(state, action, actingPlayerId, dice, isDoubles, newConsecutiveDoubles);
        // ------------------------------------------------------------------
        // 2. Three consecutive doubles → jail immediately
        // ------------------------------------------------------------------
        if (newConsecutiveDoubles >= 3) {
            return this.handleJailByTripleDoubles(state, action, config, actingPlayerId, dice, nextRngState, diceRolledEvent);
        }
        // ------------------------------------------------------------------
        // 3. Compute movement
        // ------------------------------------------------------------------
        const boardSize = config.board.size;
        const fromPosition = player.position;
        const rawNewPosition = fromPosition + total;
        const passedGo = rawNewPosition >= boardSize;
        const toPosition = rawNewPosition % boardSize;
        // Animation path: every tile index passed through (including landing tile)
        const pathTaken = [];
        for (let step = 1; step <= total; step++) {
            pathTaken.push((fromPosition + step) % boardSize);
        }
        // ------------------------------------------------------------------
        // 4. Build intermediate state: advance RNG, set ROLLED phase
        // ------------------------------------------------------------------
        let currentState = {
            ...state,
            rngState: nextRngState,
            lastActionAt: action.clientTs,
            turn: {
                ...state.turn,
                phase: TurnPhase.ROLLED,
                diceValues: dice,
                isDoubles,
                consecutiveDoubles: newConsecutiveDoubles,
                pendingDecision: null,
            },
        };
        const events = [diceRolledEvent];
        // ------------------------------------------------------------------
        // 5. Award GO salary (exactly once, even when landing exactly on GO)
        // ------------------------------------------------------------------
        if (passedGo) {
            const goReward = currentState.settings.goReward;
            const p = currentState.players[actingPlayerId];
            currentState = {
                ...currentState,
                players: {
                    ...currentState.players,
                    [actingPlayerId]: {
                        ...p,
                        money: p.money + goReward,
                        netWorth: p.netWorth + goReward,
                    },
                },
                bank: {
                    ...currentState.bank,
                    // Infinite-money banks stay at MAX_SAFE_INTEGER; finite banks debit
                    money: currentState.bank.money === Number.MAX_SAFE_INTEGER
                        ? Number.MAX_SAFE_INTEGER
                        : currentState.bank.money - goReward,
                },
            };
            events.push(ActionProcessor.buildPlayerPassedGoEvent(state, action, actingPlayerId, goReward));
        }
        // ------------------------------------------------------------------
        // 6. Move player
        // ------------------------------------------------------------------
        const playerAfterGo = currentState.players[actingPlayerId];
        currentState = {
            ...currentState,
            players: {
                ...currentState.players,
                [actingPlayerId]: {
                    ...playerAfterGo,
                    position: toPosition,
                },
            },
        };
        events.push(ActionProcessor.buildPlayerMovedEvent(state, action, actingPlayerId, fromPosition, toPosition, pathTaken, passedGo));
        // ------------------------------------------------------------------
        // 7. Resolve the landing tile — full TileResolver dispatch
        // ------------------------------------------------------------------
        const landing = this.resolveLandingTile(currentState, config, toPosition, action, actingPlayerId);
        return {
            // Exactly one version increment per action, applied here
            newState: { ...landing.newState, version: state.version + 1 },
            events: [...events, ...landing.events],
        };
    }
    /**
     * Handle the third consecutive doubles: send the player to jail immediately
     * without resolving any landing tile.
     *
     * State changes:
     *  - player.position = jailTileIndex
     *  - player.jailState set with reason THREE_DOUBLES
     *  - turn.phase = POST_ROLL (turn is over, player must END_TURN)
     *  - turn.isDoubles = false (go-again bonus forfeited)
     *  - turn.consecutiveDoubles = 0 (reset)
     *
     * Events emitted: DICE_ROLLED, PLAYER_JAILED.
     */
    handleJailByTripleDoubles(state, action, config, actingPlayerId, dice, nextRngState, diceRolledEvent) {
        const jailTileIndex = config.board.jailTileIndex;
        const player = state.players[actingPlayerId];
        const newJailState = {
            reason: JailReason.THREE_DOUBLES,
            turnsServed: 0,
            jailedAt: action.clientTs,
        };
        const newState = {
            ...state,
            rngState: nextRngState,
            lastActionAt: action.clientTs,
            version: state.version + 1,
            players: {
                ...state.players,
                [actingPlayerId]: {
                    ...player,
                    position: jailTileIndex,
                    jailState: newJailState,
                },
            },
            turn: {
                ...state.turn,
                phase: TurnPhase.POST_ROLL,
                diceValues: dice,
                // The doubles bonus is forfeited when going to jail
                isDoubles: false,
                consecutiveDoubles: 0,
                pendingDecision: null,
            },
        };
        const jailedEvent = ActionProcessor.buildPlayerJailedEvent(state, action, actingPlayerId, JailReason.THREE_DOUBLES);
        return {
            newState,
            events: [diceRolledEvent, jailedEvent],
        };
    }
    /**
     * Resolve the effects of the player landing on a tile.
     *
     * Delegates entirely to TileResolver which dispatches on TileType.
     * Every supported tile type is handled; an exhaustive TypeScript switch
     * in TileResolver will fail at compile time if a new TileType is added
     * without a corresponding case.
     *
     * @param state          State after movement (player at new position, ROLLED phase).
     * @param config         Map configuration.
     * @param tileIndex      Zero-based board index of the tile landed on.
     * @param action         The originating ROLL_DICE action.
     * @param actingPlayerId JWT-verified acting player.
     */
    resolveLandingTile(state, config, tileIndex, action, actingPlayerId) {
        return this.tileResolver.resolve(state, tileIndex, config, action, actingPlayerId);
    }
    // =========================================================================
    //  Cards
    // =========================================================================
    validateApplyCard(state, _action, _config, actingPlayerId) {
        if (state.phase !== GamePhase.IN_PROGRESS) {
            return fail(ErrorCode.E_GAME_NOT_STARTED, 'Game is not in progress.');
        }
        if (state.turn.currentPlayerId !== actingPlayerId) {
            return fail(ErrorCode.E_NOT_YOUR_TURN, 'It is not your turn.');
        }
        if (state.turn.phase !== TurnPhase.CARD_DRAWN) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot apply card outside CARD_DRAWN phase.');
        }
        if (!state.pendingCard) {
            return fail(ErrorCode.E_INVALID_ACTION, 'No pending card to apply.');
        }
        if (state.pendingCard.playerId !== actingPlayerId) {
            return fail(ErrorCode.E_INVALID_ACTION, 'Pending card belongs to another player.');
        }
        return ok();
    }
    handleApplyCard(state, action, mapConfig, actingPlayerId) {
        const result = this.cardEngine.executeCard(state, action, mapConfig, actingPlayerId, this.tileResolver);
        return {
            newState: {
                ...result.newState,
                version: state.version + 1,
            },
            events: result.events,
        };
    }
    // =========================================================================
    //  ROOM actions — stubs
    // =========================================================================
    validateRoomReady(state, _action, _config, _actingPlayerId) {
        // TODO: Validate player is in lobby, not already marked ready
        return ok();
    }
    handleRoomReady(state, _action, _config, _actingPlayerId) {
        throw new EngineNotImplementedError('ActionProcessor.handleRoomReady');
    }
    validateRoomSettingsUpdate(state, _action, _config, _actingPlayerId) {
        // TODO: Validate player is room host, game not started
        return ok();
    }
    handleRoomSettingsUpdate(state, _action, _config, _actingPlayerId) {
        throw new EngineNotImplementedError('ActionProcessor.handleRoomSettingsUpdate');
    }
    validateRoomStartGame(state, _action, _config, _actingPlayerId) {
        // TODO: Validate player is host, all players ready, 2–8 players
        return ok();
    }
    handleRoomStartGame(state, _action, _config, _actingPlayerId) {
        throw new EngineNotImplementedError('ActionProcessor.handleRoomStartGame');
    }
    // =========================================================================
    //  BANKRUPTCY actions
    // =========================================================================
    validateDeclareBankruptcy(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        return ok();
    }
    handleDeclareBankruptcy(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.DECLARE_BANKRUPTCY) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = BankruptcyPlanner.planBankruptcy(state, config, actingPlayerId, action.actionId, action.clientTs);
        const { newState, events } = BankruptcyEngine.executeBankruptcyPlan(state, plan, config, action.actionId, action.clientTs);
        return { newState: { ...newState, version: state.version + 1 }, events };
    }
    // =========================================================================
    //  BUY_PROPERTY — stub
    // =========================================================================
    validateBuyProperty(state, _action, config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (state.turn.phase !== TurnPhase.PURCHASE_DECISION) {
            return fail(ErrorCode.E_INVALID_PHASE, `Cannot buy property in phase ${state.turn.phase}`);
        }
        const decision = state.turn.pendingDecision;
        if (!decision || decision.type !== DecisionType.PURCHASE) {
            return fail(ErrorCode.E_INVALID_PHASE, 'No pending purchase decision found');
        }
        const tileId = decision.tileId;
        const tileState = state.board.tiles[tileId];
        if (!tileState) {
            throw new EngineStateCorruptionError(`TileState missing for tile ${tileId}`);
        }
        if (tileState.ownerId !== null) {
            return fail(ErrorCode.E_PROPERTY_OWNED, `Property ${tileId} is already owned by ${tileState.ownerId}`);
        }
        const tileConfig = config.board.tiles.find(t => t.id === tileId);
        if (!tileConfig) {
            throw new EngineStateCorruptionError(`MapConfig missing tile ${tileId}`);
        }
        let price = 0;
        if (tileConfig.type === TileType.PROPERTY && tileConfig.propertyData) {
            price = tileConfig.propertyData.price;
        }
        else if (tileConfig.type === TileType.RAILROAD && tileConfig.railroadData) {
            price = tileConfig.railroadData.price;
        }
        else if (tileConfig.type === TileType.UTILITY && tileConfig.utilityData) {
            price = tileConfig.utilityData.price;
        }
        else {
            throw new EngineStateCorruptionError(`Tile ${tileId} is not a purchasable type`);
        }
        const player = state.players[actingPlayerId];
        if (!player) {
            throw new EngineStateCorruptionError(`Player ${actingPlayerId} missing`);
        }
        if (player.money < price) {
            return fail(ErrorCode.E_DEBT_RECOVERY, `Insufficient funds to buy ${tileId}`);
        }
        return ok();
    }
    handleBuyProperty(state, action, config, actingPlayerId) {
        const decision = state.turn.pendingDecision;
        if (decision.type !== DecisionType.PURCHASE)
            throw new EngineStateCorruptionError('Not a purchase decision');
        const tileId = decision.tileId;
        const tileConfig = config.board.tiles.find(t => t.id === tileId);
        let price = 0;
        let groupId = null;
        if (tileConfig.type === TileType.PROPERTY && tileConfig.propertyData) {
            price = tileConfig.propertyData.price;
            groupId = tileConfig.propertyData.groupId;
        }
        else if (tileConfig.type === TileType.RAILROAD && tileConfig.railroadData) {
            price = tileConfig.railroadData.price;
        }
        else if (tileConfig.type === TileType.UTILITY && tileConfig.utilityData) {
            price = tileConfig.utilityData.price;
        }
        const player = state.players[actingPlayerId];
        // 1. Deduct money from player and give to bank
        const newPlayerMoney = player.money - price;
        const newBankMoney = state.bank.money + price;
        // 2. Add tile to player properties
        const newProperties = [...player.properties, tileId];
        // 3. Update TileState
        const newTileState = {
            ...state.board.tiles[tileId],
            ownerId: actingPlayerId,
        };
        // 4. Check for completed color group (monopoly)
        let completedGroup = false;
        if (groupId) {
            const groupConfig = config.board.propertyGroups?.find(g => g.id === groupId);
            if (groupConfig) {
                // Is every tile in the group now owned by this player?
                completedGroup = groupConfig.tileIds.every(tId => newProperties.includes(tId));
            }
        }
        const events = [];
        // PROPERTY_PURCHASED event
        events.push({
            id: `${action.actionId}::PROPERTY_PURCHASED`,
            type: EventType.PROPERTY_PURCHASED,
            roomId: state.roomId,
            gameId: state.id,
            audience: { type: 'ALL' },
            ts: action.clientTs,
            payload: {
                playerId: actingPlayerId,
                tileId: tileId,
                price: price,
            },
        });
        if (completedGroup && groupId) {
            events.push({
                id: `${action.actionId}::MONOPOLY_COMPLETED`,
                type: EventType.MONOPOLY_COMPLETED,
                roomId: state.roomId,
                gameId: state.id,
                audience: { type: 'ALL' },
                ts: action.clientTs,
                payload: {
                    playerId: actingPlayerId,
                    groupId: groupId,
                },
            });
        }
        // 5. Build new state
        const newState = {
            ...state,
            version: state.version + 1,
            bank: {
                ...state.bank,
                money: newBankMoney,
            },
            players: {
                ...state.players,
                [actingPlayerId]: {
                    ...player,
                    money: newPlayerMoney,
                    properties: newProperties,
                    // Note: netWorth does not change since cash - price + asset value cancels out
                },
            },
            board: {
                ...state.board,
                tiles: {
                    ...state.board.tiles,
                    [tileId]: newTileState,
                },
            },
            turn: {
                ...state.turn,
                phase: TurnPhase.POST_ROLL,
                pendingDecision: null,
            },
        };
        return { newState, events };
    }
    // =========================================================================
    //  DECLINE_PROPERTY — stub
    // =========================================================================
    validateDeclineProperty(state, action, config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (state.turn.pendingDecision?.type !== DecisionType.PURCHASE) {
            return fail(ErrorCode.E_INVALID_ACTION, 'No pending purchase decision.');
        }
        const tileId = action.payload.tileId;
        const tileConfig = config.board.tiles.find(t => t.id === tileId);
        if (!tileConfig || (tileConfig.type !== TileType.PROPERTY && tileConfig.type !== TileType.RAILROAD && tileConfig.type !== TileType.UTILITY)) {
            return fail(ErrorCode.E_INVALID_ACTION, 'Invalid property tile to decline.');
        }
        return ok();
    }
    handleDeclineProperty(state, action, config, actingPlayerId) {
        const declineAction = action;
        if (config.rules.auctionOnDecline) {
            return this.auctionEngine.startAuction(state, declineAction.payload.tileId, config, action.clientTs);
        }
        else {
            // If auctions disabled, just clear decision
            const newState = {
                ...state,
                turn: { ...state.turn, pendingDecision: null },
            };
            return { newState, events: [] };
        }
    }
    // =========================================================================
    //  AUCTION
    // =========================================================================
    validatePlaceBid(state, action, config, actingPlayerId) {
        if (state.phase !== GamePhase.AUCTION || !state.auction) {
            return fail(ErrorCode.E_INVALID_PHASE, 'No auction is currently active.');
        }
        if (!state.auction.activeBidders.includes(actingPlayerId)) {
            return fail(ErrorCode.E_UNAUTHORIZED, 'You are not an active bidder.');
        }
        return ok();
    }
    handlePlaceBid(state, action, config, actingPlayerId) {
        const placeBidAction = action;
        return this.auctionEngine.placeBid(state, actingPlayerId, placeBidAction.payload.amount, config, action.clientTs);
    }
    validateAuctionFold(state, _action, _config, actingPlayerId) {
        if (state.phase !== GamePhase.AUCTION || !state.auction) {
            return fail(ErrorCode.E_INVALID_PHASE, 'No auction is currently active.');
        }
        if (!state.auction.activeBidders.includes(actingPlayerId)) {
            return fail(ErrorCode.E_UNAUTHORIZED, 'You are not an active bidder.');
        }
        return ok();
    }
    handleAuctionFold(state, action, config, actingPlayerId) {
        return this.auctionEngine.foldAuction(state, actingPlayerId, config, action.clientTs);
    }
    // =========================================================================
    //  END_TURN — stub
    // =========================================================================
    validateEndTurn(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (state.turn.phase !== TurnPhase.POST_ROLL) {
            return fail(ErrorCode.E_INVALID_PHASE, `Cannot end turn in phase '${state.turn.phase}'. Expected POST_ROLL.`);
        }
        if (state.turn.pendingDecision !== null) {
            return fail(ErrorCode.E_PENDING_DECISION, 'Cannot end turn with an unresolved pending decision.');
        }
        if (state.auction !== null) {
            return fail(ErrorCode.E_INVALID_ACTION, 'Cannot end turn while an auction is active.');
        }
        const activeTrades = Object.keys(state.activeTrades);
        if (activeTrades.length > 0) {
            return fail(ErrorCode.E_INVALID_ACTION, 'Cannot end turn with active trades.');
        }
        return ok();
    }
    handleEndTurn(state, action, config, _actingPlayerId) {
        const events = [];
        // 1. Emit TURN_ENDED for the current player
        events.push({
            id: `${action.actionId}::TURN_ENDED`,
            type: EventType.TURN_ENDED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: {
                playerId: state.turn.currentPlayerId,
                turnNumber: state.turn.turnNumber,
            },
        });
        let newState;
        const turnDurationMs = 60000;
        const turnExpiresAt = action.clientTs + turnDurationMs;
        const currentPlayer = state.players[state.turn.currentPlayerId];
        // 2. Check for doubles extra turn vs next player
        if (state.turn.isDoubles && currentPlayer && currentPlayer.jailState === null) {
            newState = this.stateMachine.resetTurnForDoubles(state, turnExpiresAt);
            events.push({
                id: `${action.actionId}::EXTRA_TURN_GRANTED`,
                type: EventType.EXTRA_TURN_GRANTED,
                roomId: state.roomId,
                gameId: state.id,
                ts: action.clientTs,
                audience: { type: 'ALL' },
                payload: {
                    playerId: state.turn.currentPlayerId,
                    reason: 'DOUBLES',
                },
            });
        }
        else {
            newState = this.stateMachine.advanceToNextPlayer(state, turnExpiresAt);
        }
        // 3. Emit TURN_STARTED for whoever is next (or the same player if doubles)
        events.push({
            id: `${action.actionId}::TURN_STARTED`,
            type: EventType.TURN_STARTED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: {
                playerId: newState.turn.currentPlayerId,
                turnNumber: newState.turn.turnNumber,
            },
        });
        return { newState, events };
    }
    // =========================================================================
    //  JAIL actions — stubs
    // =========================================================================
    validatePayJailFine(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        // TODO: Validate player is in jail, has sufficient funds
        return ok();
    }
    handlePayJailFine(state, _action, _config, _actingPlayerId) {
        throw new EngineNotImplementedError('ActionProcessor.handlePayJailFine');
    }
    validateUseJailCard(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        // TODO: Validate player is in jail, holds at least 1 GOOJF card
        return ok();
    }
    handleUseJailCard(state, _action, _config, _actingPlayerId) {
        throw new EngineNotImplementedError('ActionProcessor.handleUseJailCard');
    }
    validateRollForDoubles(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        // TODO: Validate player is in jail, phase is JAIL_DECISION
        return ok();
    }
    handleRollForDoubles(state, _action, _config, _actingPlayerId) {
        throw new EngineNotImplementedError('ActionProcessor.handleRollForDoubles');
    }
    // =========================================================================
    //  PROPERTY MANAGEMENT actions — stubs
    // =========================================================================
    validateBuildHouse(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (!canManageProperties(state)) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot manage properties right now.');
        }
        return ok();
    }
    handleBuildHouse(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.BUILD_HOUSE) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = PropertyTransactionPlanner.planBuildHouse(state, config, action.payload.tileId, actingPlayerId, action.actionId, action.clientTs);
        const result = PropertyManagementEngine.applyTransaction(state, plan, config, actingPlayerId);
        const postDebt = DebtResolutionEngine.checkAndSettleDebt(result.newState, config, action.actionId, action.clientTs);
        return { newState: { ...postDebt.newState, version: state.version + 1 }, events: [...result.events, ...postDebt.events] };
    }
    validateBuildHotel(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (!canManageProperties(state)) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot manage properties right now.');
        }
        return ok();
    }
    handleBuildHotel(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.BUILD_HOTEL) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = PropertyTransactionPlanner.planBuildHotel(state, config, action.payload.tileId, actingPlayerId, action.actionId, action.clientTs);
        const result = PropertyManagementEngine.applyTransaction(state, plan, config, actingPlayerId);
        const postDebt = DebtResolutionEngine.checkAndSettleDebt(result.newState, config, action.actionId, action.clientTs);
        return { newState: { ...postDebt.newState, version: state.version + 1 }, events: [...result.events, ...postDebt.events] };
    }
    validateSellHouse(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (!canManageProperties(state)) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot manage properties right now.');
        }
        return ok();
    }
    handleSellHouse(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.SELL_HOUSE) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = PropertyTransactionPlanner.planSellHouse(state, config, action.payload.tileId, actingPlayerId, action.actionId, action.clientTs);
        const result = PropertyManagementEngine.applyTransaction(state, plan, config, actingPlayerId);
        const postDebt = DebtResolutionEngine.checkAndSettleDebt(result.newState, config, action.actionId, action.clientTs);
        return { newState: { ...postDebt.newState, version: state.version + 1 }, events: [...result.events, ...postDebt.events] };
    }
    validateSellHotel(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (!canManageProperties(state)) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot manage properties right now.');
        }
        return ok();
    }
    handleSellHotel(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.SELL_HOTEL) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = PropertyTransactionPlanner.planSellHotel(state, config, action.payload.tileId, actingPlayerId, action.actionId, action.clientTs);
        const result = PropertyManagementEngine.applyTransaction(state, plan, config, actingPlayerId);
        const postDebt = DebtResolutionEngine.checkAndSettleDebt(result.newState, config, action.actionId, action.clientTs);
        return { newState: { ...postDebt.newState, version: state.version + 1 }, events: [...result.events, ...postDebt.events] };
    }
    validateMortgageProperty(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (!canManageProperties(state)) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot manage properties right now.');
        }
        return ok();
    }
    handleMortgageProperty(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.MORTGAGE_PROPERTY) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = MortgagePlanner.planMortgageProperty(state, config, action.payload.tileId, actingPlayerId, action.actionId, action.clientTs);
        const result = MortgageEngine.applyMortgagePlan(state, plan, config, actingPlayerId);
        const postDebt = DebtResolutionEngine.checkAndSettleDebt(result.newState, config, action.actionId, action.clientTs);
        return { newState: { ...postDebt.newState, version: state.version + 1 }, events: [...result.events, ...postDebt.events] };
    }
    validateUnmortgageProperty(state, _action, _config, actingPlayerId) {
        const base = this.baseGameplayValidation(state, actingPlayerId);
        if (!base.valid)
            return base;
        if (!canManageProperties(state)) {
            return fail(ErrorCode.E_INVALID_PHASE, 'Cannot manage properties right now.');
        }
        return ok();
    }
    handleUnmortgageProperty(state, action, config, actingPlayerId) {
        if (action.type !== ActionType.UNMORTGAGE_PROPERTY) {
            throw new EngineStateCorruptionError('Invalid action type for handler');
        }
        const plan = MortgagePlanner.planUnmortgageProperty(state, config, action.payload.tileId, actingPlayerId, action.actionId, action.clientTs);
        const result = MortgageEngine.applyMortgagePlan(state, plan, config, actingPlayerId);
        const postDebt = DebtResolutionEngine.checkAndSettleDebt(result.newState, config, action.actionId, action.clientTs);
        return { newState: { ...postDebt.newState, version: state.version + 1 }, events: [...result.events, ...postDebt.events] };
    }
    // =========================================================================
    //  TRADE actions — stubs
    // =========================================================================
    validateTradePropose(state, _action, _config, _actingPlayerId) {
        // TODO: Validate POST_ROLL phase, valid target, no duplicate active trade
        return ok();
    }
    handleTradePropose(_state, _action, _config, _actingPlayerId) {
        // TODO: Delegate to TradeEngine.proposeTrade()
        throw new EngineNotImplementedError('ActionProcessor.handleTradePropose');
    }
    validateTradeAccept(_state, _action, _config, _actingPlayerId) {
        // TODO: Validate trade exists, acting player is the target, trade is PENDING
        return ok();
    }
    handleTradeAccept(_state, _action, _config, _actingPlayerId) {
        // TODO: Delegate to TradeEngine.acceptTrade()
        throw new EngineNotImplementedError('ActionProcessor.handleTradeAccept');
    }
    validateTradeReject(_state, _action, _config, _actingPlayerId) {
        // TODO: Validate trade exists, acting player is the target
        return ok();
    }
    handleTradeReject(_state, _action, _config, _actingPlayerId) {
        // TODO: Delegate to TradeEngine.rejectTrade()
        throw new EngineNotImplementedError('ActionProcessor.handleTradeReject');
    }
    validateTradeCounter(_state, _action, _config, _actingPlayerId) {
        // TODO: Validate trade exists, acting player is the target, trade is PENDING
        return ok();
    }
    handleTradeCounter(_state, _action, _config, _actingPlayerId) {
        // TODO: Delegate to TradeEngine.counterTrade()
        throw new EngineNotImplementedError('ActionProcessor.handleTradeCounter');
    }
    validateTradeCancel(_state, _action, _config, _actingPlayerId) {
        // TODO: Validate trade exists, acting player is the initiator
        return ok();
    }
    handleTradeCancel(_state, _action, _config, _actingPlayerId) {
        // TODO: Delegate to TradeEngine.cancelTrade()
        throw new EngineNotImplementedError('ActionProcessor.handleTradeCancel');
    }
    // =========================================================================
    //  SYSTEM actions
    // =========================================================================
    validateRequestFullState(_state, _action, _config, _actingPlayerId) {
        // REQUEST_FULL_STATE is always valid (used for reconnection)
        return ok();
    }
    handleRequestFullState(state, _action, _config, _actingPlayerId) {
        // Return current state with no events. The server layer will
        // serialize and send the full state snapshot to the requesting player.
        return { newState: state, events: [] };
    }
    // =========================================================================
    //  Shared Validation Helpers
    // =========================================================================
    /**
     * Common gameplay guard: game must be in progress AND it must be this player's turn.
     */
    baseGameplayValidation(state, actingPlayerId) {
        if (state.phase !== GamePhase.IN_PROGRESS) {
            return fail(ErrorCode.E_GAME_NOT_STARTED, 'Game is not in progress.');
        }
        if (state.turn.currentPlayerId !== actingPlayerId) {
            return fail(ErrorCode.E_NOT_YOUR_TURN, `It is not your turn. Current player: '${state.turn.currentPlayerId}'.`);
        }
        return ok();
    }
    // =========================================================================
    //  Event Builders (private static helpers)
    // =========================================================================
    /**
     * Build a DICE_ROLLED event.
     * Event ID is derived from action.actionId to ensure determinism.
     */
    static buildDiceRolledEvent(state, action, playerId, dice, isDoubles, consecutiveDoubles) {
        return {
            id: `${action.actionId}::DICE_ROLLED`,
            type: EventType.DICE_ROLLED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: {
                playerId,
                dice,
                total: dice[0] + dice[1],
                isDoubles,
                consecutiveDoubles,
            },
        };
    }
    /** Build a PLAYER_PASSED_GO event (awarded GO salary). */
    static buildPlayerPassedGoEvent(state, action, playerId, amount) {
        return {
            id: `${action.actionId}::PLAYER_PASSED_GO`,
            type: EventType.PLAYER_PASSED_GO,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: { playerId, amount },
        };
    }
    /** Build a PLAYER_MOVED event. */
    static buildPlayerMovedEvent(state, action, playerId, fromPosition, toPosition, pathTaken, passedGo) {
        return {
            id: `${action.actionId}::PLAYER_MOVED`,
            type: EventType.PLAYER_MOVED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: { playerId, fromPosition, toPosition, pathTaken, passedGo },
        };
    }
    /** Build a PLAYER_JAILED event. */
    static buildPlayerJailedEvent(state, action, playerId, reason) {
        return {
            id: `${action.actionId}::PLAYER_JAILED`,
            type: EventType.PLAYER_JAILED,
            roomId: state.roomId,
            gameId: state.id,
            ts: action.clientTs,
            audience: { type: 'ALL' },
            payload: { playerId, reason },
        };
    }
}
// ---------------------------------------------------------------------------
// Standalone Helpers (module-level, not class members)
// ---------------------------------------------------------------------------
function ok() {
    return { valid: true };
}
function fail(code, reason) {
    return { valid: false, code, reason };
}
//# sourceMappingURL=ActionProcessor.js.map