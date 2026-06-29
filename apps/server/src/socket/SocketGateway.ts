import { Server, Socket } from 'socket.io';
import { GameService } from '../game/GameService.js';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData, SocketResponse } from './SocketEvents.js';
import { handleSocketError } from './SocketErrorHandler.js';
import { GameState } from '@monopoly/shared';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * SocketGateway maps Socket.IO events to GameService method calls and vice-versa.
 * It is completely unaware of Monopoly rules.
 */
export class SocketGateway {
  constructor(
    private io: AppServer,
    private gameService: GameService
  ) {}

  public registerHandlers(socket: AppSocket): void {
    const playerId = socket.data.playerId;

    // Room Management
    socket.on('create_room', (payload, callback) => {
      this.safeExecute(callback, () => {
        // Assume default initial state generation happens here or in service.
        // As a stub, we just pass null. The GameService expects GameState.
        const mockInitialState = {} as GameState;
        this.gameService.createRoom(payload.roomId, mockInitialState);
        socket.join(payload.roomId);
        this.io.to(payload.roomId).emit('room_created', { roomId: payload.roomId });
      });
    });

    socket.on('join_room', (payload, callback) => {
      this.safeExecute(callback, () => {
        this.gameService.joinRoom(payload.roomId, playerId, socket.id);
        socket.join(payload.roomId);
        this.io.to(payload.roomId).emit('player_joined', { roomId: payload.roomId, playerId });
      });
    });

    socket.on('leave_room', (payload, callback) => {
      this.safeExecute(callback, () => {
        this.gameService.leaveRoom(payload.roomId, playerId);
        socket.leave(payload.roomId);
        this.io.to(payload.roomId).emit('player_left', { roomId: payload.roomId, playerId });
      });
    });

    socket.on('spectate_room', (payload, callback) => {
      this.safeExecute(callback, () => {
        this.gameService.spectate(payload.roomId, playerId, socket.id);
        socket.join(payload.roomId);
        this.io.to(payload.roomId).emit('spectator_joined', { roomId: payload.roomId, playerId });
      });
    });

    socket.on('reconnect', (payload, callback) => {
      this.safeExecute(callback, () => {
        this.gameService.reconnect(payload.roomId, playerId, socket.id);
        socket.join(payload.roomId);
        // The client would typically request game state sync next
      });
    });

    // Game Actions
    socket.on('game_action', (payload, callback) => {
      this.safeExecute(callback, () => {
        // Enforce the acting player is the authenticated player
        (payload.action as any).playerId = playerId;
        this.gameService.applyPlayerAction(payload.roomId, payload.action);
      });
    });

    // Chat and Heartbeat
    socket.on('chat_message', (payload, callback) => {
      this.safeExecute(callback, () => {
        // Stub: Just broadcast or integrate a chat service
      });
    });

    socket.on('heartbeat', () => {
      // Stub: Update connection timestamps, keep alive
    });

    // Connection lifecycle
    socket.on('disconnect', () => {
      // In a real implementation, we'd need to look up which rooms this socket was in 
      // and call gameService.leaveRoom(roomId, playerId) for each.
    });
  }

  /**
   * Wraps socket handlers to catch synchronous exceptions and format them safely.
   */
  private safeExecute(callback: ((response: SocketResponse) => void) | undefined, fn: () => void): void {
    try {
      fn();
      if (callback) callback({ success: true });
    } catch (error) {
      const socketError = handleSocketError(error);
      if (callback) {
        callback({ success: false, error: socketError });
      }
    }
  }
}
