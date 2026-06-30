import { GameEngine } from '@monopoly/engine';
import { GameState, PlayerId, ClientAction } from '@monopoly/shared';
import { MapConfig } from '@monopoly/maps';
import { RoomState, RoomConfig, PlayerSession, PersistActionFn, PersistSnapshotFn, BroadcastFn } from './interfaces.js';
import { ActionQueue } from './ActionQueue.js';
import { SnapshotManager } from './SnapshotManager.js';
import { ReplayManager } from './ReplayManager.js';
import { TimerManager } from './TimerManager.js';

export class Room {
  public state: RoomState = RoomState.WAITING;
  public players: Map<PlayerId, PlayerSession> = new Map();
  public spectators: Map<PlayerId, PlayerSession> = new Map();
  
  public actionQueue: ActionQueue | null = null;
  public snapshotManager: SnapshotManager | null = null;
  public replayManager: ReplayManager | null = null;
  public readonly timerManager: TimerManager;

  public readonly createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(
    public readonly roomId: string,
    public readonly config: RoomConfig,
    public readonly mapConfig: MapConfig,
    public readonly engine: GameEngine
  ) {
    this.timerManager = new TimerManager();
  }

  public initializeGame(
    gameState: GameState,
    persistAction: PersistActionFn,
    persistSnapshot: PersistSnapshotFn,
    broadcast: BroadcastFn
  ): void {
    this.replayManager = new ReplayManager(this.roomId);
    
    this.snapshotManager = new SnapshotManager(
      this.config.snapshotInterval,
      this.replayManager,
      persistSnapshot
    );

    this.actionQueue = new ActionQueue(
      gameState,
      this.mapConfig,
      this.engine,
      this.snapshotManager,
      this.replayManager,
      persistAction,
      (action, events, state) => {
        this.updatedAt = Date.now();
        broadcast(action, events, state);
      }
    );
  }

  public getGameState(): GameState | undefined {
    return this.actionQueue?.getState();
  }

  public enqueueAction(action: ClientAction): void {
    if (this.state !== RoomState.RUNNING || !this.actionQueue) {
      throw new Error('Room is not in RUNNING state or ActionQueue is not initialized.');
    }
    this.actionQueue.enqueue(action);
  }

  public destroy(): void {
    this.state = RoomState.DESTROYED;
    this.timerManager.cancelAll();
  }
}