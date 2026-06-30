import { PlayerId, GameState } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { Room } from './Room.js';
import { RoomConfig, PersistActionFn, PersistSnapshotFn, BroadcastFn } from './interfaces.js';
import { MapConfig } from '@monopoly/maps';
export declare class RoomManager {
    private engine;
    private mapConfig;
    private defaultRoomConfig;
    private persistAction;
    private persistSnapshot;
    private broadcastFactory;
    private rooms;
    constructor(engine: GameEngine, mapConfig: MapConfig, defaultRoomConfig: RoomConfig, persistAction: PersistActionFn, persistSnapshot: PersistSnapshotFn, broadcastFactory: (roomId: string) => BroadcastFn);
    createRoom(roomId: string, configOverrides?: Partial<RoomConfig>): Room;
    initializeRoomGame(roomId: string, gameState: GameState): void;
    getRoom(roomId: string): Room | undefined;
    destroyRoom(roomId: string): void;
    joinRoom(roomId: string, playerId: PlayerId, socketId: string, isSpectator?: boolean): void;
    leaveRoom(roomId: string, playerId: PlayerId): void;
}
//# sourceMappingURL=RoomManager.d.ts.map