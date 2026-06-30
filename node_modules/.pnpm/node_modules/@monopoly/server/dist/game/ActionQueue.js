export class ActionQueue {
    state;
    mapConfig;
    engine;
    snapshotManager;
    replayManager;
    persistAction;
    broadcast;
    queue = [];
    isProcessing = false;
    constructor(state, mapConfig, engine, snapshotManager, replayManager, persistAction, broadcast) {
        this.state = state;
        this.mapConfig = mapConfig;
        this.engine = engine;
        this.snapshotManager = snapshotManager;
        this.replayManager = replayManager;
        this.persistAction = persistAction;
        this.broadcast = broadcast;
    }
    /**
     * Pushes an action to the queue and starts processing if not currently busy.
     */
    enqueue(action) {
        this.queue.push(action);
        this.processNext();
    }
    /**
     * Retrieves the current GameState.
     * State mutation only happens internally via GameEngine.apply().
     */
    getState() {
        return this.state;
    }
    /**
     * Processes the queue sequentially. Guarantees no overlapping GameEngine.apply() execution.
     */
    async processNext() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        this.isProcessing = true;
        try {
            while (this.queue.length > 0) {
                const action = this.queue.shift();
                // 1. Engine Application
                const { newState, events } = this.engine.apply(this.state, action, this.mapConfig, action.playerId);
                // 2. State Mutation
                this.state = newState;
                // 3. Replay Manager Tracking (in-memory history)
                this.replayManager.recordAction(action, this.state.version);
                this.replayManager.recordEvents(events, this.state.version);
                // 4. Persistence
                await this.persistAction(action, this.state.version, events);
                // 5. Snapshot Check
                await this.snapshotManager.checkAndSnapshot(this.state);
                // 6. Broadcast
                if (events.length > 0) {
                    this.broadcast(action, events, this.state);
                }
            }
        }
        catch (error) {
            // In a production system, we'd log this and potentially halt the room.
            console.error('Failed to process action queue', error);
            // Depending on the nature of the error (e.g. invalid action), we could just drop it
            // and continue. But if persistence failed, we might have split-brain.
        }
        finally {
            this.isProcessing = false;
        }
    }
}
//# sourceMappingURL=ActionQueue.js.map