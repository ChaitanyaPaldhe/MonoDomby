import { Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './SocketEvents.js';
import { UnauthorizedError } from './SocketErrorHandler.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Stub authentication middleware.
 * In a real application, this would verify a JWT token from socket.handshake.auth.token.
 */
export function authenticationMiddleware(socket: AppSocket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth.token;
  
  // Example stub logic: Assume all connections are authenticated for now and use the token as playerId
  if (token) {
    socket.data.playerId = token;
    socket.data.isAuthenticated = true;
    next();
  } else {
    // We reject connections without a token.
    next(new UnauthorizedError('Missing authentication token'));
  }
}

/**
 * Stub logging middleware.
 */
export function loggingMiddleware(socket: AppSocket, next: (err?: Error) => void): void {
  console.log(`[Socket.IO] New connection attempt: ${socket.id}`);
  next();
}

/**
 * High-level payload validation stub.
 * In a fully implemented system, this might use a library like Zod to generically
 * intercept and validate event payloads based on the event name.
 * We attach it via socket.use in the gateway or server setup.
 */
export function payloadValidationMiddleware(socket: AppSocket) {
  socket.use((event, next) => {
    // event is an array like ['event_name', payload, callback]
    // Stub implementation: bypasses validation
    next();
  });
}
