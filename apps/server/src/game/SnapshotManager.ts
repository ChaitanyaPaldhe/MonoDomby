import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
import { PersistSnapshotFn } from './interfaces.js';
import { ReplayManager } from './ReplayManager.js';

export class SnapshotManager {
  private actionsSinceSnapshot: number = 0;

  constructor(
    private snapshotInterval: number = 100,
    private replayManager: ReplayManager,
    private persistSnapshot: PersistSnapshotFn
  ) {}

  /**
   * Tracks processed actions and triggers a snapshot if the interval is reached.
   */
  public async checkAndSnapshot(state: GameState): Promise<void> {
    this.actionsSinceSnapshot++;

    if (this.actionsSinceSnapshot >= this.snapshotInterval) {
      await this.createSnapshot(state);
    }
  }

  /**
   * Forces a snapshot to be taken immediately.
   */
  public async forceSnapshot(state: GameState): Promise<void> {
    await this.createSnapshot(state);
  }

  private async createSnapshot(state: GameState): Promise<void> {
    this.actionsSinceSnapshot = 0;
    
    // Store in-memory for replay support
    this.replayManager.recordSnapshot(state, state.version);

    // Persist to storage
    await this.persistSnapshot(state, state.version);
  }
}