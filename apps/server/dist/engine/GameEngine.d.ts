import type { GameState, PlayerId } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/shared';
import type { ClientAction } from '@monopoly/shared';
import type { EngineResult, CreateGameParams, EnginePlugin, ValidationResult } from './types.js';
import type { CustomTileHandlerFn } from './TileResolver.js';
import { StateMachine } from './StateMachine.js';
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
export declare class GameEngine {
    private readonly actionProcessor;
    private readonly stateMachine;
    private readonly winDetector;
    private readonly ruleEngine;
    private readonly plugins;
    /**
     * @param plugins            Optional engine plugins for post-turn hooks.
     * @param customTileHandlers Optional map of tile-ID → handler for CUSTOM tiles.
     *                           Provide when loading a MapConfig that uses TileType.CUSTOM.
     */
    constructor(plugins?: readonly EnginePlugin[], customTileHandlers?: ReadonlyMap<string, CustomTileHandlerFn>);
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
    apply(state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId): EngineResult;
    /**
     * Validate an action without applying it.
     * Useful for client-side pre-flight checks and idempotency guards.
     *
     * @param actingPlayerId JWT-verified player identity.
     */
    validate(state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId): ValidationResult;
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
    static createInitialState(params: CreateGameParams): EngineResult;
    /**
     * Rehydrate a GameState from a stored snapshot.
     * Validates the checksum before returning.
     *
     * TODO: Implement — parse, validate types, verify checksum, throw on mismatch.
     */
    static fromSnapshot(_snapshot: unknown): GameState;
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
    static computeChecksum(state: GameState): string;
    /**
     * Verify that GameState.checksum matches the recomputed checksum.
     * Used by GameStateService after loading from Redis to detect corruption.
     *
     * @returns true if the state is intact, false if corrupted or tampered.
     */
    static verifyChecksum(state: GameState): boolean;
    /**
     * Expose the StateMachine for use by server-layer timer workers.
     * (e.g., AuctionTimerWorker needs advanceToNextPlayer after auction ends)
     */
    getStateMachine(): StateMachine;
    /**
     * Build the GameSettings for a new game by merging MapConfig defaults
     * with any provided settingsOverrides.
     */
    private static buildGameSettings;
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
    private static computeInitialBankMoney;
    private registerCoreRules;
    private registerPlugins;
}
//# sourceMappingURL=GameEngine.d.ts.map