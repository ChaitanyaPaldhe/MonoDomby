import { GameEngine } from '@monopoly/engine';
import { GameState, PlayerId, ClientAction } from '@monopoly/shared';
import { MapConfig } from '@monopoly/maps';
import { RoomState, RoomConfig, PlayerSession, PersistActionFn, PersistSnapshotFn, BroadcastFn } from './interfaces.js';
import { ActionQueue } from './ActionQueue.js';
import { SnapshotManager } from './SnapshotManager.js';
import { ReplayManager } from './ReplayManager.js';
import { TimerManager } from './TimerManager.js';
export declare class Room {
    readonly roomId: string;
    readonly config: RoomConfig;
    readonly mapConfig: MapConfig;
    readonly engine: GameEngine;
    state: RoomState;
    players: Map<PlayerId, PlayerSession>;
    spectators: Map<PlayerId, PlayerSession>;
    actionQueue: ActionQueue | null;
    snapshotManager: SnapshotManager | null;
    replayManager: ReplayManager | null;
    readonly timerManager: TimerManager;
    readonly createdAt: number;
    updatedAt: number;
    constructor(roomId: string, config: RoomConfig, mapConfig: MapConfig, engine: GameEngine);
    initializeGame(gameState: GameState, persistAction: PersistActionFn, persistSnapshot: PersistSnapshotFn, broadcast: BroadcastFn): void;
    getGameState(): GameState | undefined;
    enqueueAction(action: ClientAction): void;
    destroy(): void;
}
//# sourceMappingURL=Room.d.ts.map