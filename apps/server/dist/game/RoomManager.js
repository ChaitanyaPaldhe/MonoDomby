import { Room } from './Room.js';
export class RoomManager {
    engine;
    mapConfig;
    defaultRoomConfig;
    persistAction;
    persistSnapshot;
    broadcastFactory;
    rooms = new Map();
    constructor(engine, mapConfig, defaultRoomConfig, persistAction, persistSnapshot, broadcastFactory) {
        this.engine = engine;
        this.mapConfig = mapConfig;
        this.defaultRoomConfig = defaultRoomConfig;
        this.persistAction = persistAction;
        this.persistSnapshot = persistSnapshot;
        this.broadcastFactory = broadcastFactory;
    }
    createRoom(roomId, configOverrides) {
        if (this.rooms.has(roomId)) {
            throw new Error(`Room ${roomId} already exists.`);
        }
        const config = { ...this.defaultRoomConfig, ...configOverrides };
        const room = new Room(roomId, config, this.mapConfig, this.engine);
        this.rooms.set(roomId, room);
        console.log(`[SERVER: RoomManager] room creation complete. roomId: ${roomId}`);
        return room;
    }
    initializeRoomGame(roomId, gameState) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new Error(`Room ${roomId} not found.`);
        const broadcast = this.broadcastFactory(roomId);
        room.initializeGame(gameState, this.persistAction, this.persistSnapshot, broadcast);
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    destroyRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.destroy();
            this.rooms.delete(roomId);
        }
    }
    joinRoom(roomId, playerId, socketId, isSpectator = false) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Room ${roomId} not found.`);
        }
        const session = { playerId, socketId, isSpectator, isConnected: true };
        if (isSpectator) {
            room.spectators.set(playerId, session);
        }
        else {
            // In a real implementation, you'd check maxPlayers, whether the game has started, etc.
            room.players.set(playerId, session);
            console.log(`[SERVER: RoomManager] player joins. playerId: ${playerId}, roomId: ${roomId}`);
        }
    }
    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        if (room.spectators.has(playerId)) {
            room.spectators.delete(playerId);
        }
        else if (room.players.has(playerId)) {
            console.log(`[SERVER: RoomManager] player leaves. playerId: ${playerId}, roomId: ${roomId}`);
            const session = room.players.get(playerId);
            session.isConnected = false;
            delete session.socketId;
            // Triggers reconnect timers via GameService later
        }
    }
}
//# sourceMappingURL=RoomManager.js.map