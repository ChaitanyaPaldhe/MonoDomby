import { GameEngine } from '@monopoly/engine';
import { RoomManager } from './RoomManager.js';
import { RoomState } from './interfaces.js';
import { SystemActionFactory } from './SystemActionFactory.js';
export class GameService {
    engine;
    mapConfig;
    roomManager;
    constructor(engine, mapConfig, defaultRoomConfig, persistAction, persistSnapshot, broadcastFactory) {
        this.engine = engine;
        this.mapConfig = mapConfig;
        this.roomManager = new RoomManager(engine, mapConfig, defaultRoomConfig, persistAction, persistSnapshot, broadcastFactory);
    }
    createRoom(roomId, hostPlayerId, socketId, configOverrides) {
        console.log(`[SERVER: GameService] createRoom called for roomId: ${roomId}`);
        const room = this.roomManager.createRoom(roomId, configOverrides);
        this.roomManager.joinRoom(roomId, hostPlayerId, socketId, false);
        console.log(`[SERVER: GameService] createRoom complete. Room players:`, Array.from(room.players.keys()));
        return room;
    }
    joinRoom(roomId, playerId, socketId) {
        console.log(`[SERVER: GameService] joinRoom called for roomId: ${roomId}, playerId: ${playerId}`);
        this.roomManager.joinRoom(roomId, playerId, socketId, false);
        const room = this.roomManager.getRoom(roomId);
        if (room) {
            console.log(`[SERVER: GameService] joinRoom complete. Room players:`, Array.from(room.players.keys()));
        }
    }
    spectate(roomId, playerId, socketId) {
        this.roomManager.joinRoom(roomId, playerId, socketId, true);
    }
    leaveRoom(roomId, playerId) {
        this.roomManager.leaveRoom(roomId, playerId);
        // In a complete implementation, this might trigger a reconnect timer for active players
        const room = this.roomManager.getRoom(roomId);
        if (room && room.state === RoomState.RUNNING && room.players.has(playerId)) {
            this.startReconnectTimer(room, playerId);
        }
    }
    reconnect(roomId, playerId, socketId) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            throw new Error('Room not found');
        const session = room.players.get(playerId);
        if (session) {
            session.socketId = socketId;
            session.isConnected = true;
            room.timerManager.cancel(`reconnect-${playerId}`);
        }
    }
    startGame(roomId) {
        console.log(`[SERVER: GameService] startGame called for roomId: ${roomId}`);
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            throw new Error('Room not found');
        if (room.state !== RoomState.WAITING)
            throw new Error('Cannot start room');
        console.log(`[SERVER: GameService] startGame proceeding. Room players before createInitialState:`, Array.from(room.players.keys()));
        const players = Array.from(room.players.values()).map(p => ({
            userId: p.playerId,
            playerId: p.playerId,
            displayName: p.playerId,
            avatarUrl: '',
            tokenId: ''
        }));
        console.log("1. About to call createInitialState");
        let result;
        try {
            result = GameEngine.createInitialState({
                gameId: roomId,
                roomId,
                mapConfig: this.mapConfig,
                players,
                createdAt: Date.now()
            });
        }
        catch (e) {
            console.error('[SERVER: GameService] createInitialState FAILED with:', e);
            throw e;
        }
        console.log("2. createInitialState finished");
        this.roomManager.initializeRoomGame(roomId, result.newState);
        console.log("3. initializeRoomGame finished");
        room.state = RoomState.RUNNING;
        console.log("4. room.state set RUNNING");
        this.startTurnTimer(room);
        console.log("5. startTurnTimer finished");
    } // <-- THIS BRACE WAS MISSING
    applyPlayerAction(roomId, action) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            throw new Error('Room not found');
        room.enqueueAction(action);
        // If the action successfully advanced the turn, the timer needs resetting.
        // In a fully integrated system, the GameService would subscribe to engine events 
        // (e.g. TURN_ENDED, AUCTION_STARTED) to manage timers correctly, or we can check the 
        // state changes synchronously if ActionQueue allowed awaiting. Since ActionQueue is async,
        // event callbacks emitted to BroadcastFn or an EventBus are typically used to reset timers.
    }
    // --- Timer Coordination ---
    // Note: These methods would typically be called in response to GameEvents emitted by the engine.
    startTurnTimer(room) {
        const state = room.getGameState();
        if (!state)
            return;
        const currentPlayer = state.turn.currentPlayerId;
        room.timerManager.schedule(`turn-${currentPlayer}`, room.config.turnTimeoutMs, () => {
            if (room.state !== RoomState.RUNNING)
                return;
            const current = room.getGameState();
            if (!current)
                return;
            if (current.turn.currentPlayerId === currentPlayer) {
                const action = SystemActionFactory.createAutoEndTurn(current, currentPlayer);
                room.enqueueAction(action);
            }
        });
    }
    startReconnectTimer(room, playerId) {
        room.timerManager.schedule(`reconnect-${playerId}`, room.config.reconnectTimeoutMs, () => {
            if (room.state !== RoomState.RUNNING)
                return;
            const current = room.getGameState();
            if (!current)
                return;
            const action = SystemActionFactory.createAutoBankruptcy(current, playerId);
            room.enqueueAction(action);
        });
    }
    // --- Data Access ---
    getGameState(roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return undefined;
        return room.getGameState();
    }
    getLobbyState(roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return undefined;
        const result = {
            players: Array.from(room.players.keys()),
            roomState: room.state
        };
        const state = room.getGameState();
        if (state) {
            result.state = state;
        }
        return result;
    }
    // --- Persistence & Replay ---
    getReplay(roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            throw new Error('Room not found');
        // In a fully persisted setup, this would load from a database.
        // Here we query the in-memory ReplayManager.
        if (!room.replayManager)
            return { snapshots: [], actions: [] };
        const snapshot = room.replayManager.getSnapshotBefore(Number.MAX_SAFE_INTEGER);
        const actions = snapshot ? room.replayManager.getActionsAfter(snapshot.actionIndex) : [];
        return {
            snapshots: snapshot ? [snapshot] : [],
            actions
        };
    }
}
//# sourceMappingURL=GameService.js.map