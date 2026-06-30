export class ReplayManager {
    roomId;
    snapshots = [];
    actions = [];
    events = [];
    constructor(roomId) {
        this.roomId = roomId;
    }
    recordSnapshot(state, index) {
        // We deep clone or rely on immutability here. Since the engine is immutable, 
        // the state object reference won't be mutated by future actions.
        this.snapshots.push({
            id: `snap-${this.roomId}-${index}`,
            roomId: this.roomId,
            actionIndex: index,
            state,
            timestamp: Date.now()
        });
    }
    recordAction(action, index) {
        this.actions.push({
            id: action.actionId,
            roomId: this.roomId,
            index,
            action,
            timestamp: Date.now()
        });
    }
    recordEvents(events, actionIndex) {
        for (const event of events) {
            this.events.push({
                id: event.id,
                roomId: this.roomId,
                actionIndex,
                event,
                timestamp: Date.now()
            });
        }
    }
    /**
     * Retrieves the nearest snapshot before or at the given action index.
     */
    getSnapshotBefore(actionIndex) {
        let closest;
        for (const snap of this.snapshots) {
            if (snap.actionIndex <= actionIndex) {
                if (!closest || snap.actionIndex > closest.actionIndex) {
                    closest = snap;
                }
            }
        }
        return closest;
    }
    /**
     * Retrieves all actions that occurred after the given snapshot index.
     */
    getActionsAfter(snapshotIndex) {
        return this.actions.filter(a => a.index > snapshotIndex).sort((a, b) => a.index - b.index);
    }
    /**
     * Retrieves all events associated with a specific action index.
     */
    getEventsForAction(actionIndex) {
        return this.events.filter(e => e.actionIndex === actionIndex);
    }
}
//# sourceMappingURL=ReplayManager.js.map