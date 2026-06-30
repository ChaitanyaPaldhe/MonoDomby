import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { Room } from './Room.js';
import { RoomConfig, RoomState, PersistActionFn, PersistSnapshotFn, BroadcastFn } from './interfaces.js';
import { MapConfig } from '@monopoly/maps';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  constructor(
    private engine: GameEngine,
    private mapConfig: MapConfig,
    private defaultRoomConfig: RoomConfig,
    private persistAction: PersistActionFn,
    private persistSnapshot: PersistSnapshotFn,
    private broadcastFactory: (roomId: string) => BroadcastFn
  ) {}

  public createRoom(roomId: string, configOverrides?: Partial<RoomConfig>): Room {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists.`);
    }

    const config = { ...this.defaultRoomConfig, ...configOverrides };
    
    const room = new Room(
      roomId,
      config,
      this.mapConfig,
      this.engine
    );

    this.rooms.set(roomId, room);
    console.log(`[SERVER: RoomManager] room creation complete. roomId: ${roomId}`);
    return room;
  }

  public initializeRoomGame(roomId: string, gameState: GameState): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room ${roomId} not found.`);
    
    const broadcast = this.broadcastFactory(roomId);
    room.initializeGame(
      gameState,
      this.persistAction,
      this.persistSnapshot,
      broadcast
    );
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.destroy();
      this.rooms.delete(roomId);
    }
  }

  public joinRoom(roomId: string, playerId: PlayerId, socketId: string, isSpectator: boolean = false): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found.`);
    }

    const session = { playerId, socketId, isSpectator, isConnected: true };
    if (isSpectator) {
      room.spectators.set(playerId, session);
    } else {
      // In a real implementation, you'd check maxPlayers, whether the game has started, etc.
      room.players.set(playerId, session);
      console.log(`[SERVER: RoomManager] player joins. playerId: ${playerId}, roomId: ${roomId}`);
    }
  }

  public leaveRoom(roomId: string, playerId: PlayerId): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.spectators.has(playerId)) {
      room.spectators.delete(playerId);
    } else if (room.players.has(playerId)) {
      console.log(`[SERVER: RoomManager] player leaves. playerId: ${playerId}, roomId: ${roomId}`);
      const session = room.players.get(playerId)!;
      session.isConnected = false;
      delete session.socketId;
      // Triggers reconnect timers via GameService later
    }
  }
}