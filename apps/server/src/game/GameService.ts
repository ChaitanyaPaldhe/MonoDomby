import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { MapConfig } from '@monopoly/maps';
import { RoomManager } from './RoomManager.js';
import { RoomState, RoomConfig, PersistActionFn, PersistSnapshotFn, BroadcastFn, PersistedSnapshot, PersistedAction } from './interfaces.js';
import { SystemActionFactory } from './SystemActionFactory.js';
import { Room } from './Room.js';

export class GameService {
  private roomManager: RoomManager;

  constructor(
    engine: GameEngine,
    mapConfig: MapConfig,
    defaultRoomConfig: RoomConfig,
    persistAction: PersistActionFn,
    persistSnapshot: PersistSnapshotFn,
    broadcastFactory: (roomId: string) => BroadcastFn
  ) {
    this.roomManager = new RoomManager(
      engine,
      mapConfig,
      defaultRoomConfig,
      persistAction,
      persistSnapshot,
      broadcastFactory
    );
  }

  public createRoom(roomId: string, initialState: GameState, configOverrides?: Partial<RoomConfig>): Room {
    return this.roomManager.createRoom(roomId, initialState, configOverrides);
  }

  public joinRoom(roomId: string, playerId: PlayerId, socketId: string): void {
    this.roomManager.joinRoom(roomId, playerId, socketId, false);
  }

  public spectate(roomId: string, playerId: PlayerId, socketId: string): void {
    this.roomManager.joinRoom(roomId, playerId, socketId, true);
  }

  public leaveRoom(roomId: string, playerId: PlayerId): void {
    this.roomManager.leaveRoom(roomId, playerId);
    
    // In a complete implementation, this might trigger a reconnect timer for active players
    const room = this.roomManager.getRoom(roomId);
    if (room && room.state === RoomState.RUNNING && room.players.has(playerId)) {
      this.startReconnectTimer(room, playerId);
    }
  }

  public reconnect(roomId: string, playerId: PlayerId, socketId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const session = room.players.get(playerId);
    if (session) {
      session.socketId = socketId;
      session.isConnected = true;
      room.timerManager.cancel(`reconnect-${playerId}`);
    }
  }

  public startGame(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.state !== RoomState.STARTING) throw new Error('Cannot start room');

    room.state = RoomState.RUNNING;
    
    // Begin turn timer for the first player
    this.startTurnTimer(room);
  }

  public applyPlayerAction(roomId: string, action: ClientAction): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    room.enqueueAction(action);
    
    // If the action successfully advanced the turn, the timer needs resetting.
    // In a fully integrated system, the GameService would subscribe to engine events 
    // (e.g. TURN_ENDED, AUCTION_STARTED) to manage timers correctly, or we can check the 
    // state changes synchronously if ActionQueue allowed awaiting. Since ActionQueue is async,
    // event callbacks emitted to BroadcastFn or an EventBus are typically used to reset timers.
  }

  // --- Timer Coordination ---
  // Note: These methods would typically be called in response to GameEvents emitted by the engine.

  public startTurnTimer(room: Room): void {
    const state = room.getGameState();
    const currentPlayer = state.turn.currentPlayerId;

    room.timerManager.schedule(`turn-${currentPlayer}`, room.config.turnTimeoutMs, () => {
      if (room.state !== RoomState.RUNNING) return;
      
      const current = room.getGameState();
      if (current.turn.currentPlayerId === currentPlayer) {
        const action = SystemActionFactory.createAutoEndTurn(current, currentPlayer);
        room.enqueueAction(action);
      }
    });
  }

  public startReconnectTimer(room: Room, playerId: PlayerId): void {
    room.timerManager.schedule(`reconnect-${playerId}`, room.config.reconnectTimeoutMs, () => {
      if (room.state !== RoomState.RUNNING) return;
      
      const current = room.getGameState();
      const action = SystemActionFactory.createAutoBankruptcy(current, playerId);
      room.enqueueAction(action);
    });
  }

  // --- Persistence & Replay ---

  public getReplay(roomId: string): { snapshots: PersistedSnapshot[], actions: PersistedAction[] } {
    const room = this.roomManager.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    
    // In a fully persisted setup, this would load from a database.
    // Here we query the in-memory ReplayManager.
    const snapshot = room.replayManager.getSnapshotBefore(Number.MAX_SAFE_INTEGER);
    const actions = snapshot ? room.replayManager.getActionsAfter(snapshot.actionIndex) : [];
    
    return {
      snapshots: snapshot ? [snapshot] : [],
      actions
    };
  }
}