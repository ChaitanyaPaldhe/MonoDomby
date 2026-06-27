// =============================================================================
// engine/errors.ts
// Custom error classes for the game engine.
// All engine errors are typed and carry structured context for logging.
// =============================================================================

import type { ErrorCode } from '@monopoly/shared';

// ---------------------------------------------------------------------------
// Base Engine Error
// ---------------------------------------------------------------------------

/** Base class for all engine-originated errors. */
export class EngineError extends Error {
  public readonly code: ErrorCode;
  public readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: ErrorCode,
    context: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.context = context;
    // Maintain proper prototype chain in compiled JS
    Object.setPrototypeOf(this, EngineError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Validation Error
// ---------------------------------------------------------------------------

/**
 * Thrown when an action fails validation.
 * The server catches this and emits GAME:ACTION_REJECTED to the client.
 * This is not a bug — it is an expected, handled error path.
 */
export class EngineValidationError extends EngineError {
  constructor(reason: string, code: ErrorCode, context: Readonly<Record<string, unknown>> = {}) {
    super(reason, code, context);
    this.name = 'EngineValidationError';
    Object.setPrototypeOf(this, EngineValidationError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Not Implemented Error
// ---------------------------------------------------------------------------

/**
 * Thrown by TODO stub handler functions.
 * Indicates the handler skeleton exists but the business logic is not yet written.
 * Should never reach production.
 */
export class EngineNotImplementedError extends Error {
  public readonly handlerName: string;

  constructor(handlerName: string) {
    super(
      `[ENGINE] Handler '${handlerName}' is not yet implemented. ` +
      `This is a TODO stub — implement the business logic before enabling this action.`,
    );
    this.name = 'EngineNotImplementedError';
    this.handlerName = handlerName;
    Object.setPrototypeOf(this, EngineNotImplementedError.prototype);
  }
}

// ---------------------------------------------------------------------------
// State Corruption Error
// ---------------------------------------------------------------------------

/**
 * Thrown when the engine detects an inconsistent or corrupt GameState.
 * For example: checksum mismatch, invalid version sequence, or impossible
 * invariant violation (e.g., total money in system changed without a transfer).
 */
export class EngineStateCorruptionError extends EngineError {
  constructor(reason: string, context: Readonly<Record<string, unknown>> = {}) {
    super(reason, 'E_UNKNOWN' as ErrorCode, context);
    this.name = 'EngineStateCorruptionError';
    Object.setPrototypeOf(this, EngineStateCorruptionError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Phase Transition Error
// ---------------------------------------------------------------------------

/**
 * Thrown when an illegal state machine transition is attempted.
 * E.g., transitioning from IN_PROGRESS directly to LOBBY.
 */
export class EngineTransitionError extends EngineError {
  constructor(from: string, to: string) {
    super(
      `[STATE_MACHINE] Illegal transition from '${from}' to '${to}'.`,
      'E_INVALID_PHASE' as ErrorCode,
      { from, to },
    );
    this.name = 'EngineTransitionError';
    Object.setPrototypeOf(this, EngineTransitionError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Map Config Error
// ---------------------------------------------------------------------------

/**
 * Thrown when a MapConfig is invalid or missing required content.
 * Detected at game-start time, not during gameplay.
 */
export class MapConfigError extends Error {
  public readonly field: string;

  constructor(field: string, reason: string) {
    super(`[MAP_CONFIG] Invalid config at '${field}': ${reason}`);
    this.name = 'MapConfigError';
    this.field = field;
    Object.setPrototypeOf(this, MapConfigError.prototype);
  }
}
