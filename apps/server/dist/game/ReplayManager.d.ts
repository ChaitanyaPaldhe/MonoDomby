import { ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { PersistedAction, PersistedEvent, PersistedSnapshot } from './interfaces.js';
export declare class ReplayManager {
    private roomId;
    private snapshots;
    private actions;
    private events;
    constructor(roomId: string);
    recordSnapshot(state: GameState, index: number): void;
    recordAction(action: ClientAction, index: number): void;
    recordEvents(events: readonly GameEvent[], actionIndex: number): void;
    /**
     * Retrieves the nearest snapshot before or at the given action index.
     */
    getSnapshotBefore(actionIndex: number): PersistedSnapshot | undefined;
    /**
     * Retrieves all actions that occurred after the given snapshot index.
     */
    getActionsAfter(snapshotIndex: number): PersistedAction[];
    /**
     * Retrieves all events associated with a specific action index.
     */
    getEventsForAction(actionIndex: number): PersistedEvent[];
}
//# sourceMappingURL=ReplayManager.d.ts.map