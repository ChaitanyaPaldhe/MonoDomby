import { PlayerId, ClientAction, GameState } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { MapConfig } from '@monopoly/maps';
import { RoomConfig, PersistActionFn, PersistSnapshotFn, BroadcastFn, PersistedSnapshot, PersistedAction } from './interfaces.js';
import { Room } from './Room.js';
export declare class GameService {
    private engine;
    private mapConfig;
    private roomManager;
    constructor(engine: GameEngine, mapConfig: MapConfig, defaultRoomConfig: RoomConfig, persistAction: PersistActionFn, persistSnapshot: PersistSnapshotFn, broadcastFactory: (roomId: string) => BroadcastFn);
    createRoom(roomId: string, hostPlayerId: PlayerId, socketId: string, configOverrides?: Partial<RoomConfig>): Room;
    joinRoom(roomId: string, playerId: PlayerId, socketId: string): void;
    spectate(roomId: string, playerId: PlayerId, socketId: string): void;
    leaveRoom(roomId: string, playerId: PlayerId): void;
    reconnect(roomId: string, playerId: PlayerId, socketId: string): void;
    startGame(roomId: string): void;
    applyPlayerAction(roomId: string, action: ClientAction): void;
    startTurnTimer(room: Room): void;
    startReconnectTimer(room: Room, playerId: PlayerId): void;
    getGameState(roomId: string): GameState | undefined;
    getLobbyState(roomId: string): {
        players: string[];
        state?: GameState;
        roomState: string;
    } | undefined;
    getReplay(roomId: string): {
        snapshots: PersistedSnapshot[];
        actions: PersistedAction[];
    };
}
//# sourceMappingURL=GameService.d.ts.map