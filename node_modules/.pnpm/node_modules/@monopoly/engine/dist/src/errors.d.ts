import type { ErrorCode } from '@monopoly/shared';
/** Base class for all engine-originated errors. */
export declare class EngineError extends Error {
    readonly code: ErrorCode;
    readonly context: Readonly<Record<string, unknown>>;
    constructor(message: string, code: ErrorCode, context?: Readonly<Record<string, unknown>>);
}
/**
 * Thrown when an action fails validation.
 * The server catches this and emits GAME:ACTION_REJECTED to the client.
 * This is not a bug — it is an expected, handled error path.
 */
export declare class EngineValidationError extends EngineError {
    constructor(reason: string, code: ErrorCode, context?: Readonly<Record<string, unknown>>);
}
/**
 * Thrown by TODO stub handler functions.
 * Indicates the handler skeleton exists but the business logic is not yet written.
 * Should never reach production.
 */
export declare class EngineNotImplementedError extends Error {
    readonly handlerName: string;
    constructor(handlerName: string);
}
/**
 * Thrown when the engine detects an inconsistent or corrupt GameState.
 * For example: checksum mismatch, invalid version sequence, or impossible
 * invariant violation (e.g., total money in system changed without a transfer).
 */
export declare class EngineStateCorruptionError extends EngineError {
    constructor(reason: string, context?: Readonly<Record<string, unknown>>);
}
/**
 * Thrown when an illegal state machine transition is attempted.
 * E.g., transitioning from IN_PROGRESS directly to LOBBY.
 */
export declare class EngineTransitionError extends EngineError {
    constructor(from: string, to: string);
}
/**
 * Thrown when a MapConfig is invalid or missing required content.
 * Detected at game-start time, not during gameplay.
 */
export declare class MapConfigError extends Error {
    readonly field: string;
    constructor(field: string, reason: string);
}
//# sourceMappingURL=errors.d.ts.map