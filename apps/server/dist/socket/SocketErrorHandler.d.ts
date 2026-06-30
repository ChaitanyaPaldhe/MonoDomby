import { SocketErrorPayload } from './SocketEvents.js';
/**
 * Base class for all Socket errors.
 * We do not expose stack traces.
 */
export declare class SocketError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
    toPayload(): SocketErrorPayload;
}
export declare class UnauthorizedError extends SocketError {
    constructor(message?: string);
}
export declare class ValidationError extends SocketError {
    constructor(message: string);
}
export declare class RoomNotFoundError extends SocketError {
    constructor(roomId: string);
}
export declare class ActionFailedError extends SocketError {
    constructor(message: string);
}
/**
 * Centralized error handler to catch exceptions and format them into SocketErrorPayloads
 */
export declare function handleSocketError(error: unknown): SocketErrorPayload;
//# sourceMappingURL=SocketErrorHandler.d.ts.map