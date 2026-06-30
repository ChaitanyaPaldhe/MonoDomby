import { handleSocketError } from './SocketErrorHandler.js';
/**
 * SocketGateway maps Socket.IO events to GameService method calls and vice-versa.
 * It is completely unaware of Monopoly rules.
 */
export class SocketGateway {
    io;
    gameService;
    constructor(io, gameService) {
        this.io = io;
        this.gameService = gameService;
    }
    registerHandlers(socket) {
        const playerId = socket.data.playerId;
        // Room Management
        socket.on('create_room', (payload, callback) => {
            console.log(`[SERVER: SocketGateway] create_room received. SocketId: ${socket.id}, PlayerId: ${playerId}, RoomId: ${payload.roomId}`);
            this.safeExecute(callback, () => {
                this.gameService.createRoom(payload.roomId, playerId, socket.id);
                socket.join(payload.roomId);
                this.io.to(payload.roomId).emit('room_created', { roomId: payload.roomId });
                const lobbyState = this.gameService.getLobbyState(payload.roomId);
                if (lobbyState) {
                    const emitPayload = {
                        roomId: payload.roomId,
                        players: lobbyState.players,
                        roomState: lobbyState.roomState
                    };
                    if (lobbyState.state) {
                        emitPayload.state = lobbyState.state;
                    }
                    console.log(`[SERVER: SocketGateway] Broadcasting room_joined immediately before. Players:`, Array.from(lobbyState.players));
                    socket.emit('room_joined', emitPayload);
                }
            });
        });
        socket.on('join_room', (payload, callback) => {
            console.log(`[SERVER: SocketGateway] join_room received. SocketId: ${socket.id}, PlayerId: ${playerId}, RoomId: ${payload.roomId}`);
            this.safeExecute(callback, () => {
                this.gameService.joinRoom(payload.roomId, playerId, socket.id);
                socket.join(payload.roomId);
                this.io.to(payload.roomId).emit('player_joined', { roomId: payload.roomId, playerId });
                const lobbyState = this.gameService.getLobbyState(payload.roomId);
                if (lobbyState) {
                    const emitPayload = {
                        roomId: payload.roomId,
                        players: lobbyState.players,
                        roomState: lobbyState.roomState
                    };
                    if (lobbyState.state) {
                        emitPayload.state = lobbyState.state;
                    }
                    console.log(`[SERVER: SocketGateway] Broadcasting room_joined immediately before. Players:`, Array.from(lobbyState.players));
                    socket.emit('room_joined', emitPayload);
                }
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
        socket.on('start_game', (payload, callback) => {
            console.log(`[SERVER: SocketGateway] start_game received. SocketId: ${socket.id}, PlayerId: ${playerId}, RoomId: ${payload.roomId}`);
            this.safeExecute(callback, () => {
                this.gameService.startGame(payload.roomId);
                const state = this.gameService.getGameState(payload.roomId);
                if (state) {
                    const room = this.gameService.getLobbyState(payload.roomId);
                    console.log(`[SERVER: SocketGateway] Broadcasting game_state immediately before. Players:`, room ? Array.from(room.players) : []);
                    this.io.to(payload.roomId).emit('game_state', { roomId: payload.roomId, state });
                }
            });
        });
        // Game Actions
        socket.on('game_action', (payload, callback) => {
            this.safeExecute(callback, () => {
                // Enforce the acting player is the authenticated player
                payload.action.playerId = playerId;
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
    safeExecute(callback, fn) {
        try {
            fn();
            if (callback)
                callback({ success: true });
        }
        catch (error) {
            const socketError = handleSocketError(error);
            if (callback) {
                callback({ success: false, error: socketError });
            }
        }
    }
}
//# sourceMappingURL=SocketGateway.js.map