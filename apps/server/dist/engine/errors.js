"use strict";
// =============================================================================
// engine/errors.ts
// Custom error classes for the game engine.
// All engine errors are typed and carry structured context for logging.
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapConfigError = exports.EngineTransitionError = exports.EngineStateCorruptionError = exports.EngineNotImplementedError = exports.EngineValidationError = exports.EngineError = void 0;
// ---------------------------------------------------------------------------
// Base Engine Error
// ---------------------------------------------------------------------------
/** Base class for all engine-originated errors. */
class EngineError extends Error {
    code;
    context;
    constructor(message, code, context = {}) {
        super(message);
        this.name = 'EngineError';
        this.code = code;
        this.context = context;
        // Maintain proper prototype chain in compiled JS
        Object.setPrototypeOf(this, EngineError.prototype);
    }
}
exports.EngineError = EngineError;
// ---------------------------------------------------------------------------
// Validation Error
// ---------------------------------------------------------------------------
/**
 * Thrown when an action fails validation.
 * The server catches this and emits GAME:ACTION_REJECTED to the client.
 * This is not a bug — it is an expected, handled error path.
 */
class EngineValidationError extends EngineError {
    constructor(reason, code, context = {}) {
        super(reason, code, context);
        this.name = 'EngineValidationError';
        Object.setPrototypeOf(this, EngineValidationError.prototype);
    }
}
exports.EngineValidationError = EngineValidationError;
// ---------------------------------------------------------------------------
// Not Implemented Error
// ---------------------------------------------------------------------------
/**
 * Thrown by TODO stub handler functions.
 * Indicates the handler skeleton exists but the business logic is not yet written.
 * Should never reach production.
 */
class EngineNotImplementedError extends Error {
    handlerName;
    constructor(handlerName) {
        super(`[ENGINE] Handler '${handlerName}' is not yet implemented. ` +
            `This is a TODO stub — implement the business logic before enabling this action.`);
        this.name = 'EngineNotImplementedError';
        this.handlerName = handlerName;
        Object.setPrototypeOf(this, EngineNotImplementedError.prototype);
    }
}
exports.EngineNotImplementedError = EngineNotImplementedError;
// ---------------------------------------------------------------------------
// State Corruption Error
// ---------------------------------------------------------------------------
/**
 * Thrown when the engine detects an inconsistent or corrupt GameState.
 * For example: checksum mismatch, invalid version sequence, or impossible
 * invariant violation (e.g., total money in system changed without a transfer).
 */
class EngineStateCorruptionError extends EngineError {
    constructor(reason, context = {}) {
        super(reason, 'E_UNKNOWN', context);
        this.name = 'EngineStateCorruptionError';
        Object.setPrototypeOf(this, EngineStateCorruptionError.prototype);
    }
}
exports.EngineStateCorruptionError = EngineStateCorruptionError;
// ---------------------------------------------------------------------------
// Phase Transition Error
// ---------------------------------------------------------------------------
/**
 * Thrown when an illegal state machine transition is attempted.
 * E.g., transitioning from IN_PROGRESS directly to LOBBY.
 */
class EngineTransitionError extends EngineError {
    constructor(from, to) {
        super(`[STATE_MACHINE] Illegal transition from '${from}' to '${to}'.`, 'E_INVALID_PHASE', { from, to });
        this.name = 'EngineTransitionError';
        Object.setPrototypeOf(this, EngineTransitionError.prototype);
    }
}
exports.EngineTransitionError = EngineTransitionError;
// ---------------------------------------------------------------------------
// Map Config Error
// ---------------------------------------------------------------------------
/**
 * Thrown when a MapConfig is invalid or missing required content.
 * Detected at game-start time, not during gameplay.
 */
class MapConfigError extends Error {
    field;
    constructor(field, reason) {
        super(`[MAP_CONFIG] Invalid config at '${field}': ${reason}`);
        this.name = 'MapConfigError';
        this.field = field;
        Object.setPrototypeOf(this, MapConfigError.prototype);
    }
}
exports.MapConfigError = MapConfigError;
//# sourceMappingURL=errors.js.map