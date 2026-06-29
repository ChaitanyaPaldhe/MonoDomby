import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { PersistedAction, PersistedEvent, PersistedSnapshot } from './interfaces.js';

export class ReplayManager {
  private snapshots: PersistedSnapshot[] = [];
  private actions: PersistedAction[] = [];
  private events: PersistedEvent[] = [];

  constructor(private roomId: string) {}

  public recordSnapshot(state: GameState, index: number): void {
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

  public recordAction(action: ClientAction, index: number): void {
    this.actions.push({
      id: action.actionId,
      roomId: this.roomId,
      index,
      action,
      timestamp: Date.now()
    });
  }

  public recordEvents(events: readonly GameEvent[], actionIndex: number): void {
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
  public getSnapshotBefore(actionIndex: number): PersistedSnapshot | undefined {
    let closest: PersistedSnapshot | undefined;
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
  public getActionsAfter(snapshotIndex: number): PersistedAction[] {
    return this.actions.filter(a => a.index > snapshotIndex).sort((a, b) => a.index - b.index);
  }

  /**
   * Retrieves all events associated with a specific action index.
   */
  public getEventsForAction(actionIndex: number): PersistedEvent[] {
    return this.events.filter(e => e.actionIndex === actionIndex);
  }
}