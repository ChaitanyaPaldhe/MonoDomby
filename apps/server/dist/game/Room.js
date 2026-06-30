import { RoomState } from './interfaces.js';
import { ActionQueue } from './ActionQueue.js';
import { SnapshotManager } from './SnapshotManager.js';
import { ReplayManager } from './ReplayManager.js';
import { TimerManager } from './TimerManager.js';
export class Room {
    roomId;
    config;
    mapConfig;
    engine;
    state = RoomState.WAITING;
    players = new Map();
    spectators = new Map();
    actionQueue = null;
    snapshotManager = null;
    replayManager = null;
    timerManager;
    createdAt = Date.now();
    updatedAt = Date.now();
    constructor(roomId, config, mapConfig, engine) {
        this.roomId = roomId;
        this.config = config;
        this.mapConfig = mapConfig;
        this.engine = engine;
        this.timerManager = new TimerManager();
    }
    initializeGame(gameState, persistAction, persistSnapshot, broadcast) {
        this.replayManager = new ReplayManager(this.roomId);
        this.snapshotManager = new SnapshotManager(this.config.snapshotInterval, this.replayManager, persistSnapshot);
        this.actionQueue = new ActionQueue(gameState, this.mapConfig, this.engine, this.snapshotManager, this.replayManager, persistAction, (events) => {
            this.updatedAt = Date.now();
            broadcast(events);
        });
    }
    getGameState() {
        return this.actionQueue?.getState();
    }
    enqueueAction(action) {
        if (this.state !== RoomState.RUNNING || !this.actionQueue) {
            throw new Error('Room is not in RUNNING state or ActionQueue is not initialized.');
        }
        this.actionQueue.enqueue(action);
    }
    destroy() {
        this.state = RoomState.DESTROYED;
        this.timerManager.cancelAll();
    }
}
//# sourceMappingURL=Room.js.map