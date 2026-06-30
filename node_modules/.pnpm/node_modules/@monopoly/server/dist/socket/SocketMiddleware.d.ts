import { Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './SocketEvents.js';
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
/**
 * Stub authentication middleware.
 * In a real application, this would verify a JWT token from socket.handshake.auth.token.
 */
export declare function authenticationMiddleware(socket: AppSocket, next: (err?: Error) => void): void;
/**
 * Stub logging middleware.
 */
export declare function loggingMiddleware(socket: AppSocket, next: (err?: Error) => void): void;
/**
 * High-level payload validation stub.
 * In a fully implemented system, this might use a library like Zod to generically
 * intercept and validate event payloads based on the event name.
 * We attach it via socket.use in the gateway or server setup.
 */
export declare function payloadValidationMiddleware(socket: AppSocket): void;
export {};
//# sourceMappingURL=SocketMiddleware.d.ts.map