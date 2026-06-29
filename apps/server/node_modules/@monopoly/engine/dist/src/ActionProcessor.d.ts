import type { MapConfig } from '@monopoly/maps';
import type { GameState, PlayerId, ClientAction } from '@monopoly/shared';
import type { ValidationResult, EngineResult } from './types.js';
import { StateMachine } from './StateMachine.js';
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
export declare class ActionProcessor {
    private readonly stateMachine;
    private readonly validators;
    private readonly handlers;
    private readonly tileResolver;
    private readonly cardEngine;
    private auctionEngine;
    /**
     * @param stateMachine       Shared StateMachine instance from GameEngine.
     * @param customTileHandlers Optional map of tile-ID → handler for CUSTOM tiles.
     *                           Pass at game-start if the map has CUSTOM tile types.
     */
    constructor(stateMachine: StateMachine, customTileHandlers?: ReadonlyMap<string, import('./TileResolver.js').CustomTileHandlerFn>);
    /**
     * Validate an action against the current state.
     * Returns ValidationResult — does NOT throw on validation failure.
     *
     * @param state        Current authoritative game state.
     * @param action       Client-submitted action.
     * @param mapConfig    Loaded map configuration for this game.
     * @param actingPlayerId JWT-verified player performing this action.
     */
    validate(state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId): ValidationResult;
    /**
     * Apply a previously validated action to the state.
     * Returns the new state and emitted events.
     *
     * IMPORTANT: Only call this AFTER validate() returns { valid: true }.
     * @throws {EngineNotImplementedError} for TODO stub handlers.
     * @throws {EngineValidationError} if a handler detects a late-breaking conflict.
     */
    apply(state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId): EngineResult;
    private registerValidators;
    private registerHandlers;
    private validateRollDice;
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
    private handleRollDice;
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
    private handleJailByTripleDoubles;
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
    private resolveLandingTile;
    private validateApplyCard;
    private handleApplyCard;
    private validateRoomReady;
    private handleRoomReady;
    private validateRoomSettingsUpdate;
    private handleRoomSettingsUpdate;
    private validateRoomStartGame;
    private handleRoomStartGame;
    private validateDeclareBankruptcy;
    private handleDeclareBankruptcy;
    private validateBuyProperty;
    private handleBuyProperty;
    private validateDeclineProperty;
    private handleDeclineProperty;
    private validatePlaceBid;
    private handlePlaceBid;
    private validateAuctionFold;
    private handleAuctionFold;
    private validateEndTurn;
    private handleEndTurn;
    private validatePayJailFine;
    private handlePayJailFine;
    private validateUseJailCard;
    private handleUseJailCard;
    private validateRollForDoubles;
    private handleRollForDoubles;
    private validateBuildHouse;
    private handleBuildHouse;
    private validateBuildHotel;
    private handleBuildHotel;
    private validateSellHouse;
    private handleSellHouse;
    private validateSellHotel;
    private handleSellHotel;
    private validateMortgageProperty;
    private handleMortgageProperty;
    private validateUnmortgageProperty;
    private handleUnmortgageProperty;
    private validateTradePropose;
    private handleTradePropose;
    private validateTradeAccept;
    private handleTradeAccept;
    private validateTradeReject;
    private handleTradeReject;
    private validateTradeCounter;
    private handleTradeCounter;
    private validateTradeCancel;
    private handleTradeCancel;
    private validateRequestFullState;
    private handleRequestFullState;
    /**
     * Common gameplay guard: game must be in progress AND it must be this player's turn.
     */
    private baseGameplayValidation;
    /**
     * Build a DICE_ROLLED event.
     * Event ID is derived from action.actionId to ensure determinism.
     */
    private static buildDiceRolledEvent;
    /** Build a PLAYER_PASSED_GO event (awarded GO salary). */
    private static buildPlayerPassedGoEvent;
    /** Build a PLAYER_MOVED event. */
    private static buildPlayerMovedEvent;
    /** Build a PLAYER_JAILED event. */
    private static buildPlayerJailedEvent;
}
//# sourceMappingURL=ActionProcessor.d.ts.map