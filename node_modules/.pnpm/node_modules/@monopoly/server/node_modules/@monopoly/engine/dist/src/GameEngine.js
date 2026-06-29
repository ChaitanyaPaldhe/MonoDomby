"use strict";
// =============================================================================
// engine/GameEngine.ts
// The main engine orchestrator.
//
// This is the ONLY public entry point into the game logic.
//
// Design:
// - Pure function: apply(state, action, mapConfig) → { newState, events }
// - No I/O, no side effects, no framework dependencies.
//   Exception: createInitialState uses node:crypto for seeding — but this
//   is initialisation, not gameplay, and the CSPRNG call is isolated here.
// - Coordinates ActionProcessor, StateMachine, WinDetector, RuleEngine.
// - Plugins are registered at construction time.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@monopoly/shared");
;
const errors_js_1 = require("./errors.js");
const ActionProcessor_js_1 = require("./ActionProcessor.js");
const StateMachine_js_1 = require("./StateMachine.js");
const WinDetector_js_1 = require("./WinDetector.js");
const RuleEngine_js_1 = require("./RuleEngine.js");
const DiceEngine_js_1 = require("./DiceEngine.js");
const CardEngine_js_1 = require("./CardEngine.js");
// ---------------------------------------------------------------------------
// GameEngine
// ---------------------------------------------------------------------------
/**
 * The Monopoly game engine.
 *
 * ### Core Contract
 * ```
 * apply(state, action, mapConfig, actingPlayerId) → { newState, events }
 * ```
 * - Deterministic: same inputs always produce the same output.
 * - Pure: no side effects, no I/O, no global state.
 * - Immutable: input `state` is never mutated.
 *
 * ### Usage
 * ```typescript
 * const engine = new GameEngine();
 *
 * // Game initialisation (call once, persist the result to Redis)
 * const { newState, events } = GameEngine.createInitialState(params);
 *
 * // Per-action (every player action in the running game)
 * // actingPlayerId is extracted from the verified JWT by the Socket.IO middleware
 * const { newState, events } = engine.apply(currentState, action, mapConfig, actingPlayerId);
 * ```
 */
class GameEngine {
    actionProcessor;
    stateMachine;
    winDetector;
    ruleEngine;
    plugins;
    /**
     * @param plugins            Optional engine plugins for post-turn hooks.
     * @param customTileHandlers Optional map of tile-ID → handler for CUSTOM tiles.
     *                           Provide when loading a MapConfig that uses TileType.CUSTOM.
     */
    constructor(plugins = [], customTileHandlers) {
        this.stateMachine = new StateMachine_js_1.StateMachine();
        this.actionProcessor = new ActionProcessor_js_1.ActionProcessor(this.stateMachine, customTileHandlers);
        this.winDetector = new WinDetector_js_1.WinDetector();
        this.ruleEngine = new RuleEngine_js_1.RuleEngine();
        this.plugins = plugins;
        this.registerCoreRules();
        this.registerPlugins(plugins);
    }
    // -------------------------------------------------------------------------
    // Core Public API
    // -------------------------------------------------------------------------
    /**
     * The primary engine entry point.
     *
     * Pipeline:
     * 1. Validate action (uses actingPlayerId from JWT, never from payload).
     * 2. Apply action handler → intermediate { newState, events }.
     * 3. Run rule pipeline.
     * 4. Check win condition.
     * 5. If game won: transition to ENDED, emit GAME_ENDED event.
     * 6. Return final { newState, events }.
     *
     * @param state          Current authoritative game state (loaded from Redis).
     * @param action         Validated client action.
     * @param mapConfig      Map configuration for this room.
     * @param actingPlayerId JWT-verified player identity. NEVER from payload.
     *
     * @throws {EngineValidationError}     Caught by server → emits ACTION_REJECTED.
     * @throws {EngineNotImplementedError} TODO stub handlers during development.
     */
    apply(state, action, mapConfig, actingPlayerId) {
        // Step 1: Validate
        const validation = this.actionProcessor.validate(state, action, mapConfig, actingPlayerId);
        if (!validation.valid) {
            throw new errors_js_1.EngineValidationError(validation.reason, validation.code);
        }
        // Step 2: Apply action handler
        const intermediate = this.actionProcessor.apply(state, action, mapConfig, actingPlayerId);
        // Step 3: Run rule pipeline
        const stateAfterRules = this.ruleEngine.applyAll(intermediate.newState, {
            playerId: actingPlayerId,
            mapConfig,
        });
        // Step 4: Check win condition
        const winResult = this.winDetector.check(stateAfterRules, mapConfig);
        if (winResult.won) {
            // Step 5: Transition to ENDED
            const endedState = this.stateMachine.transitionGame(stateAfterRules, shared_1.GamePhase.ENDED);
            const finalState = {
                ...endedState,
                checksum: GameEngine.computeChecksum(endedState),
            };
            // TODO: Build full GAME_ENDED event with final standings
            return { newState: finalState, events: [...intermediate.events] };
        }
        const finalState = {
            ...stateAfterRules,
            checksum: GameEngine.computeChecksum(stateAfterRules),
        };
        return { newState: finalState, events: intermediate.events };
    }
    /**
     * Validate an action without applying it.
     * Useful for client-side pre-flight checks and idempotency guards.
     *
     * @param actingPlayerId JWT-verified player identity.
     */
    validate(state, action, mapConfig, actingPlayerId) {
        return this.actionProcessor.validate(state, action, mapConfig, actingPlayerId);
    }
    // -------------------------------------------------------------------------
    // State Creation
    // -------------------------------------------------------------------------
    /**
     * Create the initial GameState for a new game.
     *
     * This is the ONLY place the engine performs I/O (crypto.randomBytes for seed
     * generation when no explicit seed is provided). All subsequent calls are pure.
     *
     * Initialisation sequence:
     *  1.  Validate player count (2–8).
     *  2.  Generate (or use provided) RNG seed → RNGState.
     *  3.  Build GameSettings from MapConfig + settingsOverrides.
     *  4.  Shuffle Chance and Community Chest decks using the PRNG.
     *  5.  Build playerOrder (preserves params.players array order).
     *  6.  Build each PlayerState:
     *        position = 0 (GO), money = startingMoney, properties = [],
     *        jailState = null, getOutOfJailCards = 0, isBankrupt = false.
     *  7.  Build BoardState: all tiles unowned, no houses/hotels.
     *  8.  Build BankState: houses/hotels from MapConfig, money computed.
     *  9.  Build TurnState for the first player in PRE_ROLL phase.
     * 10.  Assemble GameState with version = 1, phase = IN_PROGRESS.
     * 11.  Compute SHA-256 checksum over deterministic fields.
     * 12.  Build GAME_STARTED GameEvent (broadcast) and GameEventRef (eventLog).
     * 13.  Return { newState, events: [GAME_STARTED] }.
     *
     * @param params - Game creation parameters including players, mapConfig, and optional seed.
     * @returns EngineResult with the initial GameState and GAME_STARTED event.
     * @throws Error if fewer than 2 or more than 8 players are provided.
     */
    static createInitialState(params) {
        const { mapConfig, players, createdAt } = params;
        // --- Guard: player count ---
        if (players.length < 2) {
            throw new Error(`[GameEngine] At least 2 players are required to start a game. Received: ${players.length}.`);
        }
        if (players.length > 8) {
            throw new Error(`[GameEngine] Maximum 8 players supported. Received: ${players.length}.`);
        }
        // 1. RNG seed (use provided or generate from CSPRNG)
        const rngSeed = params.rngSeed ?? (0, node_crypto_1.randomBytes)(32).toString('hex');
        // 2. Initialise PRNG from seed + gameId (gameId mixes in uniqueness)
        let rngState = DiceEngine_js_1.DiceEngine.createRNGState(rngSeed, params.gameId);
        // 3. Build GameSettings
        const settings = GameEngine.buildGameSettings(mapConfig, params.settingsOverrides, players.length);
        // 4. Shuffle card decks (advances PRNG state)
        const cardEngine = new CardEngine_js_1.CardEngine();
        let cardDecks;
        [cardDecks, rngState] = cardEngine.buildInitialDecks(mapConfig, rngState);
        // 5. Player order (input order is canonical turn order)
        const playerOrder = players.map(p => p.playerId);
        // 6. Player states
        const startingMoney = settings.startingMoney;
        const playerStates = {};
        for (const playerInfo of players) {
            playerStates[playerInfo.playerId] = {
                id: playerInfo.playerId,
                userId: playerInfo.userId,
                displayName: playerInfo.displayName,
                avatarUrl: playerInfo.avatarUrl,
                tokenId: playerInfo.tokenId,
                position: 0, // All players start at GO (tile index 0)
                money: startingMoney, // From MapConfig.bank.startingMoney or override
                properties: [],
                jailState: null,
                getOutOfJailCards: 0,
                isBankrupt: false,
                isConnected: true, // Assume connected at game start
                isSpectator: false,
                netWorth: startingMoney, // Initial netWorth = cash (no assets yet)
            };
        }
        // 7. Board state — all tiles unowned, no buildings
        const tileStates = {};
        for (const tile of mapConfig.board.tiles) {
            const tileId = tile.id;
            tileStates[tileId] = {
                tileId,
                ownerId: null,
                isMortgaged: false,
                houses: 0,
                hasHotel: false,
            };
        }
        const board = { tiles: tileStates };
        // 8. Bank state
        const bank = {
            money: mapConfig.bank.infiniteMoney
                ? Number.MAX_SAFE_INTEGER
                : GameEngine.computeInitialBankMoney(mapConfig, players.length, startingMoney),
            houses: mapConfig.bank.initialHouses,
            hotels: mapConfig.bank.initialHotels,
            freeParkingPot: 0,
        };
        // 9. Turn state — first player, PRE_ROLL phase
        const firstPlayerId = playerOrder[0];
        const turn = {
            currentPlayerId: firstPlayerId,
            turnNumber: 1,
            phase: shared_1.TurnPhase.PRE_ROLL,
            diceValues: null,
            isDoubles: false,
            consecutiveDoubles: 0,
            turnExpiresAt: createdAt + settings.turnTimeSeconds * 1000,
            pendingDecision: null,
        };
        // 10. Assemble state (checksum placeholder = empty string)
        const stateForChecksum = {
            id: params.gameId,
            roomId: params.roomId,
            mapId: mapConfig.meta.id,
            version: 1,
            phase: shared_1.GamePhase.IN_PROGRESS,
            playerOrder,
            players: playerStates,
            board,
            bank,
            cardDecks,
            pendingCard: null,
            auction: null,
            activeTrades: {},
            turn,
            settings,
            eventLog: [], // Populated below after building the event
            createdAt,
            lastActionAt: createdAt,
            rngState,
            checksum: '', // Computed in step 11
        };
        // 11. Compute checksum over deterministic state fields
        const checksum = GameEngine.computeChecksum(stateForChecksum);
        // 12. Build GAME_STARTED event.
        //     The event ID is derived deterministically from the gameId so that
        //     calling createInitialState twice with the same params yields identical results.
        const eventId = (0, node_crypto_1.createHash)('sha256')
            .update(`game-started:${params.gameId}`)
            .digest('hex');
        const startingPositions = {};
        const startingMoneyRecord = {};
        for (const pid of playerOrder) {
            startingPositions[pid] = 0;
            startingMoneyRecord[pid] = startingMoney;
        }
        const gameStartedEvent = {
            id: eventId,
            type: shared_1.EventType.GAME_STARTED,
            roomId: params.roomId,
            gameId: params.gameId,
            ts: createdAt,
            payload: {
                playerOrder,
                startingPositions: startingPositions,
                startingMoney: startingMoneyRecord,
            },
            audience: { type: 'ALL' },
        };
        // 13. GameEventRef for the eventLog ring buffer
        const gameStartedRef = {
            id: eventId,
            type: shared_1.EventType.GAME_STARTED,
            ts: createdAt,
            payload: startingPositions,
        };
        // 14. Final state with checksum + initial event in log
        const initialState = {
            ...stateForChecksum,
            checksum,
            eventLog: [gameStartedRef],
        };
        return {
            newState: initialState,
            events: [gameStartedEvent],
        };
    }
    /**
     * Rehydrate a GameState from a stored snapshot.
     * Validates the checksum before returning.
     *
     * TODO: Implement — parse, validate types, verify checksum, throw on mismatch.
     */
    static fromSnapshot(_snapshot) {
        throw new errors_js_1.EngineNotImplementedError('GameEngine.fromSnapshot');
    }
    // -------------------------------------------------------------------------
    // Checksum
    // -------------------------------------------------------------------------
    /**
     * Compute the SHA-256 checksum over the deterministic subset of GameState.
     *
     * Fields included (these are the fields that change during gameplay):
     * - version
     * - turn.turnNumber, turn.currentPlayerId
     * - Each player's money, position, and bankruptcy status (in playerOrder order)
     * - Each tile's ownerId, house count, hotel flag, and mortgage status (sorted by tileId)
     * - bank.houses, bank.hotels, bank.money
     *
     * Fields excluded:
     * - eventLog (cosmetic, append-only)
     * - rngState (changes every dice roll; tracked separately)
     * - checksum itself
     * - lastActionAt (timing metadata)
     *
     * @returns 64-character lowercase hex string.
     */
    static computeChecksum(state) {
        const canonical = {
            v: state.version,
            tn: state.turn.turnNumber,
            cp: state.turn.currentPlayerId,
            // Players in canonical turn order — position-dependent
            pm: state.playerOrder.map(id => {
                const p = state.players[id];
                return {
                    id,
                    money: p?.money ?? 0,
                    position: p?.position ?? 0,
                    bankrupt: p?.isBankrupt ?? false,
                    goojf: p?.getOutOfJailCards ?? 0,
                };
            }),
            pc: state.pendingCard ? {
                id: state.pendingCard.cardId,
                seq: state.pendingCard.drawSequence,
                del: state.pendingCard.removedFromDeck,
            } : null,
            // Tiles sorted by ID for stable ordering regardless of insertion order
            tiles: Object.entries(state.board.tiles)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([id, t]) => ({
                id,
                owner: t.ownerId,
                h: t.houses,
                ht: t.hasHotel ? 1 : 0,
                m: t.isMortgaged ? 1 : 0,
            })),
            bank: {
                h: state.bank.houses,
                ht: state.bank.hotels,
                // Represent infinite money as a stable sentinel so the checksum
                // doesn't change based on the exact MAX_SAFE_INTEGER representation.
                m: state.bank.money === Number.MAX_SAFE_INTEGER ? '__INF__' : state.bank.money,
                fp: state.bank.freeParkingPot,
            },
        };
        return (0, node_crypto_1.createHash)('sha256')
            .update(JSON.stringify(canonical))
            .digest('hex');
    }
    /**
     * Verify that GameState.checksum matches the recomputed checksum.
     * Used by GameStateService after loading from Redis to detect corruption.
     *
     * @returns true if the state is intact, false if corrupted or tampered.
     */
    static verifyChecksum(state) {
        try {
            const expected = GameEngine.computeChecksum(state);
            return state.checksum === expected;
        }
        catch {
            return false;
        }
    }
    // -------------------------------------------------------------------------
    // Sub-engine Accessors
    // -------------------------------------------------------------------------
    /**
     * Expose the StateMachine for use by server-layer timer workers.
     * (e.g., AuctionTimerWorker needs advanceToNextPlayer after auction ends)
     */
    getStateMachine() {
        return this.stateMachine;
    }
    // -------------------------------------------------------------------------
    // Private Static Helpers
    // -------------------------------------------------------------------------
    /**
     * Build the GameSettings for a new game by merging MapConfig defaults
     * with any provided settingsOverrides.
     */
    static buildGameSettings(mapConfig, overrides, playerCount) {
        const rules = mapConfig.rules;
        const bank = mapConfig.bank;
        return {
            mapId: mapConfig.meta.id,
            maxPlayers: overrides?.maxPlayers ?? playerCount,
            turnTimeSeconds: overrides?.turnTimeSeconds ?? 120,
            auctionDurationSeconds: overrides?.auctionDurationSeconds ?? rules.auctionConfig.durationSeconds,
            startingMoney: overrides?.startingMoney ?? bank.startingMoney,
            goReward: overrides?.goReward ?? bank.goReward,
            enableFreeParking: overrides?.enableFreeParking ?? rules.freeParkingMoney,
            enableAuctions: overrides?.enableAuctions ?? rules.auctionOnDecline,
            disconnectedPlayerPolicy: overrides?.disconnectedPlayerPolicy ?? shared_1.DisconnectedPlayerPolicy.SKIP,
            winCondition: overrides?.winCondition ?? rules.winCondition,
            netWorthTarget: overrides?.netWorthTarget ?? rules.netWorthTarget ?? null,
            turnLimit: overrides?.turnLimit ?? rules.turnLimit ?? null,
            isPrivate: overrides?.isPrivate ?? false,
        };
    }
    /**
     * Compute a reasonable initial bank cash amount for finite-money games.
     *
     * Strategy: sum of all purchasable tile prices (properties, railroads, utilities)
     * represents the total "asset pool" the bank holds at game start.
     * A transaction float of (playerCount × startingMoney) is added to cover
     * GO rewards and other bank payments throughout the game.
     *
     * NOTE: Standard Monopoly specifies exact bill denominations, but since MapConfig
     * does not model individual denominations, we use this computed approximation.
     * Override via settingsOverrides if a specific amount is required.
     */
    static computeInitialBankMoney(mapConfig, playerCount, startingMoneyPerPlayer) {
        const assetPool = mapConfig.board.tiles.reduce((sum, tile) => {
            const price = tile.propertyData?.price ??
                tile.railroadData?.price ??
                tile.utilityData?.price ??
                0;
            return sum + price;
        }, 0);
        // Add float: 2× each player's starting money to cover GO rewards, etc.
        return assetPool + playerCount * startingMoneyPerPlayer * 2;
    }
    // -------------------------------------------------------------------------
    // Private Instance Setup
    // -------------------------------------------------------------------------
    registerCoreRules() {
        // TODO: Register core rules when implemented
        // e.g. this.ruleEngine.register(RuleEngine.RULE_PASS_GO, PassGoRule.handler, 10);
        // e.g. this.ruleEngine.register(RuleEngine.RULE_RECOMPUTE_NET_WORTH, NetWorthRule.handler, 200);
    }
    registerPlugins(plugins) {
        for (const plugin of plugins) {
            if (plugin.onTurnEnd) {
                this.ruleEngine.register(`plugin/${plugin.id}/turn-end`, plugin.onTurnEnd, 500);
            }
            // TODO: Inject customValidators into actionProcessor's validator registry
        }
    }
}
exports.GameEngine = GameEngine;
//# sourceMappingURL=GameEngine.js.map