import { ClientAction, GameState } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { PersistActionFn, BroadcastFn } from './interfaces.js';
import { SnapshotManager } from './SnapshotManager.js';
import { ReplayManager } from './ReplayManager.js';
import { MapConfig } from '@monopoly/maps';
export declare class ActionQueue {
    private state;
    private mapConfig;
    private engine;
    private snapshotManager;
    private replayManager;
    private persistAction;
    private broadcast;
    private queue;
    private isProcessing;
    constructor(state: GameState, mapConfig: MapConfig, engine: GameEngine, snapshotManager: SnapshotManager, replayManager: ReplayManager, persistAction: PersistActionFn, broadcast: BroadcastFn);
    /**
     * Pushes an action to the queue and starts processing if not currently busy.
     */
    enqueue(action: ClientAction): void;
    /**
     * Retrieves the current GameState.
     * State mutation only happens internally via GameEngine.apply().
     */
    getState(): GameState;
    /**
     * Processes the queue sequentially. Guarantees no overlapping GameEngine.apply() execution.
     */
    private processNext;
}
//# sourceMappingURL=ActionQueue.d.ts.map