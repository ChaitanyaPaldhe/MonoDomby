export class SnapshotManager {
    snapshotInterval;
    replayManager;
    persistSnapshot;
    actionsSinceSnapshot = 0;
    constructor(snapshotInterval = 100, replayManager, persistSnapshot) {
        this.snapshotInterval = snapshotInterval;
        this.replayManager = replayManager;
        this.persistSnapshot = persistSnapshot;
    }
    /**
     * Tracks processed actions and triggers a snapshot if the interval is reached.
     */
    async checkAndSnapshot(state) {
        this.actionsSinceSnapshot++;
        if (this.actionsSinceSnapshot >= this.snapshotInterval) {
            await this.createSnapshot(state);
        }
    }
    /**
     * Forces a snapshot to be taken immediately.
     */
    async forceSnapshot(state) {
        await this.createSnapshot(state);
    }
    async createSnapshot(state) {
        this.actionsSinceSnapshot = 0;
        // Store in-memory for replay support
        this.replayManager.recordSnapshot(state, state.version);
        // Persist to storage
        await this.persistSnapshot(state, state.version);
    }
}
//# sourceMappingURL=SnapshotManager.js.map