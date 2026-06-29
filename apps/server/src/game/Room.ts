import { GameEngine } from '@monopoly/engine';
import { GameState, PlayerId, ClientAction } from '@monopoly/shared';
import { MapConfig } from '@monopoly/maps';
import { RoomState, RoomConfig, PlayerSession } from './interfaces.js';
import { ActionQueue } from './ActionQueue.js';
import { SnapshotManager } from './SnapshotManager.js';
import { ReplayManager } from './ReplayManager.js';
import { TimerManager } from './TimerManager.js';
import { SystemActionFactory } from './SystemActionFactory.js';

export class Room {
  public state: RoomState = RoomState.WAITING;
  public players: Map<PlayerId, PlayerSession> = new Map();
  public spectators: Map<PlayerId, PlayerSession> = new Map();
  
  public readonly actionQueue: ActionQueue;
  public readonly snapshotManager: SnapshotManager;
  public readonly replayManager: ReplayManager;
  public readonly timerManager: TimerManager;

  public readonly createdAt: number = Date.now();
  public updatedAt: number = Date.now();

  constructor(
    public readonly roomId: string,
    public readonly config: RoomConfig,
    public readonly mapConfig: MapConfig,
    public readonly engine: GameEngine,
    public readonly gameState: GameState,
    persistAction: any,
    persistSnapshot: any,
    broadcast: any
  ) {
    this.timerManager = new TimerManager();
    this.replayManager = new ReplayManager(roomId);
    
    this.snapshotManager = new SnapshotManager(
      config.snapshotInterval,
      this.replayManager,
      persistSnapshot
    );

    this.actionQueue = new ActionQueue(
      gameState,
      this.mapConfig,
      engine,
      this.snapshotManager,
      this.replayManager,
      persistAction,
      (events) => {
        this.updatedAt = Date.now();
        broadcast(events);
      }
    );
  }

  public getGameState(): GameState {
    return this.actionQueue.getState();
  }

  public enqueueAction(action: ClientAction): void {
    if (this.state !== RoomState.RUNNING) {
      throw new Error('Room is not in RUNNING state.');
    }
    this.actionQueue.enqueue(action);
  }

  public destroy(): void {
    this.state = RoomState.DESTROYED;
    this.timerManager.cancelAll();
  }
}