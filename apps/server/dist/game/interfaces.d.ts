import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
export declare enum RoomState {
    WAITING = "WAITING",
    STARTING = "STARTING",
    RUNNING = "RUNNING",
    FINISHED = "FINISHED",
    DESTROYED = "DESTROYED"
}
export interface PlayerSession {
    playerId: PlayerId;
    socketId?: string;
    isSpectator: boolean;
    isConnected: boolean;
}
export interface RoomConfig {
    maxPlayers: number;
    snapshotInterval: number;
    turnTimeoutMs: number;
    auctionTimeoutMs: number;
    reconnectTimeoutMs: number;
}
export interface PersistedSnapshot {
    id: string;
    roomId: string;
    actionIndex: number;
    state: GameState;
    timestamp: number;
}
export interface PersistedAction {
    id: string;
    roomId: string;
    index: number;
    action: ClientAction;
    timestamp: number;
}
export interface PersistedEvent {
    id: string;
    roomId: string;
    actionIndex: number;
    event: GameEvent;
    timestamp: number;
}
export type BroadcastFn = (events: readonly GameEvent[]) => void;
export type PersistActionFn = (action: ClientAction, index: number, events: readonly GameEvent[]) => Promise<void>;
export type PersistSnapshotFn = (state: GameState, index: number) => Promise<void>;
//# sourceMappingURL=interfaces.d.ts.map