import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
export enum RoomState {
  WAITING = 'WAITING',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED',
  DESTROYED = 'DESTROYED'
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

// Data persistence structures
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

// Callbacks used by the orchestration layer
export type BroadcastFn = (events: readonly GameEvent[]) => void;
export type PersistActionFn = (action: ClientAction, index: number, events: readonly GameEvent[]) => Promise<void>;
export type PersistSnapshotFn = (state: GameState, index: number) => Promise<void>;