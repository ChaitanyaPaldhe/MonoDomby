import { SocketErrorPayload } from './SocketEvents.js';

/**
 * Base class for all Socket errors.
 * We do not expose stack traces.
 */
export class SocketError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'SocketError';
  }

  public toPayload(): SocketErrorPayload {
    return {
      code: this.code,
      message: this.message
    };
  }
}

export class UnauthorizedError extends SocketError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message);
  }
}

export class ValidationError extends SocketError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

export class RoomNotFoundError extends SocketError {
  constructor(roomId: string) {
    super('ROOM_NOT_FOUND', `Room ${roomId} not found`);
  }
}

export class ActionFailedError extends SocketError {
  constructor(message: string) {
    super('ACTION_FAILED', message);
  }
}

/**
 * Centralized error handler to catch exceptions and format them into SocketErrorPayloads
 */
export function handleSocketError(error: unknown): SocketErrorPayload {
  if (error instanceof SocketError) {
    return error.toPayload();
  }

  // Generic fallback for unhandled exceptions to prevent leaking implementation details
  return {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred.'
  };
}
