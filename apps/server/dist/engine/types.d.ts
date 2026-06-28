import type { GameState, PlayerId, TileId } from '@monopoly/shared';
import type { ClientAction, ActionType } from '@monopoly/shared';
import type { GameEvent } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/shared';
import type { ErrorCode } from '@monopoly/shared';
/**
 * The output of every engine operation.
 * The engine is a pure function: (state, action) → EngineResult.
 * newState is always a new object; the input state is never mutated.
 */
export interface EngineResult {
    readonly newState: GameState;
    readonly events: readonly GameEvent[];
}
/**
 * Result of validating a client action before applying it.
 * On failure, includes a typed error code and human-readable reason.
 */
export type ValidationResult = {
    readonly valid: true;
} | {
    readonly valid: false;
    readonly reason: string;
    readonly code: ErrorCode;
};
/**
 * A pure validation function for a specific action type.
 * Returns valid:true if the action CAN be applied to the current state.
 * Must not modify state.
 *
 * actingPlayerId is verified by the server auth middleware (JWT → SocketData).
 * It is NEVER taken from the action payload.
 */
export type Validator = (state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId) => ValidationResult;
/**
 * A pure action handler function for a specific action type.
 * Returns the new state + events that resulted from applying the action.
 * Must not modify the input state.
 *
 * actingPlayerId is the JWT-verified player performing this action.
 */
export type ActionHandler = (state: GameState, action: ClientAction, mapConfig: MapConfig, actingPlayerId: PlayerId) => EngineResult;
/**
 * Context object passed to rule handlers.
 * Contains all information a rule needs without granting write access to state.
 */
export interface RuleContext {
    readonly playerId: PlayerId;
    readonly tileId?: TileId;
    readonly amount?: number;
    readonly mapConfig: MapConfig;
    /** Arbitrary additional context key-value pairs. */
    readonly extras?: Readonly<Record<string, unknown>>;
}
/**
 * A pluggable rule function.
 * Applied in a pipeline after the primary action handler.
 * Returns a partial state diff that is shallow-merged onto the new state.
 * Rules must be pure — no side effects.
 */
export type RuleHandler = (state: GameState, context: RuleContext) => Readonly<Partial<GameState>>;
/** A named registered rule with optional ordering priority. */
export interface RegisteredRule {
    readonly id: string;
    /** Lower number = runs first. Default: 100. */
    readonly priority: number;
    readonly handler: RuleHandler;
}
/**
 * Handler for a named custom card effect (CardEffectType.CUSTOM).
 * Registered in the CardHandlerRegistry by ID.
 */
export interface CardHandler {
    readonly id: string;
    readonly handle: (state: GameState, playerId: PlayerId, cardId: string, mapConfig: MapConfig) => EngineResult;
}
/**
 * Result of checking the win condition after a state transition.
 */
export type WinCheckResult = {
    readonly won: false;
} | {
    readonly won: true;
    readonly winnerId: PlayerId;
    readonly reason: string;
};
/**
 * Extension point for adding custom game mechanics without modifying the engine.
 * Plugins are registered per-game at startup and are scoped per map.
 */
export interface EnginePlugin {
    readonly id: string;
    /** Called after a turn ends. May return a partial state diff. */
    readonly onTurnEnd?: RuleHandler;
    /** Called after a player lands on a tile. */
    readonly onPropertyLanded?: (state: GameState, tileId: TileId, mapConfig: MapConfig) => Readonly<Partial<GameState>>;
    /** Custom card effect handlers, keyed by customHandler ID from MapConfig. */
    readonly customCardHandlers?: ReadonlyMap<string, CardHandler>;
    /** Additional validators that run after the built-in validator for an action type. */
    readonly customValidators?: ReadonlyMap<ActionType, Validator>;
}
/**
 * Parameters required to build the initial GameState for a new game.
 * Passed to GameEngine.createInitialState().
 */
export interface CreateGameParams {
    readonly gameId: string;
    readonly roomId: string;
    readonly mapConfig: MapConfig;
    /** Ordered player info. The array index determines turn order. */
    readonly players: ReadonlyArray<{
        readonly userId: string;
        readonly playerId: PlayerId;
        readonly displayName: string;
        readonly avatarUrl: string;
        readonly tokenId: string;
    }>;
    /** Override any GameSettings on top of MapConfig defaults. */
    readonly settingsOverrides?: Readonly<Partial<import('@monopoly/shared').GameSettings>>;
    /** Optional explicit RNG seed for testing. If omitted, a CSPRNG seed is generated. */
    readonly rngSeed?: string;
    readonly createdAt: number;
}
export interface PropertyTransactionPlan {
    readonly tileChanges: Record<TileId, import('@monopoly/shared').TileState>;
    readonly bankHouseChange: number;
    readonly bankHotelChange: number;
    readonly playerMoneyChange: number;
    readonly events: readonly GameEvent[];
}
export interface MortgagePlan {
    readonly tileId: TileId;
    readonly isMortgaging: boolean;
    readonly playerMoneyChange: number;
    readonly events: readonly GameEvent[];
}
//# sourceMappingURL=types.d.ts.map