import { GameState } from '@monopoly/shared';
import { PersistSnapshotFn } from './interfaces.js';
import { ReplayManager } from './ReplayManager.js';
export declare class SnapshotManager {
    private snapshotInterval;
    private replayManager;
    private persistSnapshot;
    private actionsSinceSnapshot;
    constructor(snapshotInterval: number | undefined, replayManager: ReplayManager, persistSnapshot: PersistSnapshotFn);
    /**
     * Tracks processed actions and triggers a snapshot if the interval is reached.
     */
    checkAndSnapshot(state: GameState): Promise<void>;
    /**
     * Forces a snapshot to be taken immediately.
     */
    forceSnapshot(state: GameState): Promise<void>;
    private createSnapshot;
}
//# sourceMappingURL=SnapshotManager.d.ts.map