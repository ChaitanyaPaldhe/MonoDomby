import { ClientAction, GameEvent, GameState, PlayerId } from '@monopoly/shared';

// ----------------------------------------------------------------------------
// Room
// ----------------------------------------------------------------------------

export interface RoomRecord {
  id: string;
  gameId: string | null;
  state: 'WAITING' | 'STARTING' | 'RUNNING' | 'FINISHED' | 'DESTROYED';
  hostPlayerId: string | null;
  joinCode: string | null;
  isPrivate: boolean;
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoomReadRepository {
  findById(roomId: string): Promise<RoomRecord | null>;
  findByJoinCode(joinCode: string): Promise<RoomRecord | null>;
  listActiveRooms(): Promise<RoomRecord[]>;
}

export interface IRoomWriteRepository {
  create(room: Omit<RoomRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  update(roomId: string, updates: Partial<RoomRecord>): Promise<void>;
  delete(roomId: string): Promise<void>;
}

export interface IRoomRepository extends IRoomReadRepository, IRoomWriteRepository {}

// ----------------------------------------------------------------------------
// Game
// ----------------------------------------------------------------------------

export interface GameRecord {
  id: string;
  mapConfigId: string;
  createdAt: Date;
  finishedAt: Date | null;
  winnerId: string | null;
}

export interface IGameReadRepository {
  findById(gameId: string): Promise<GameRecord | null>;
}

export interface IGameWriteRepository {
  create(game: Omit<GameRecord, 'createdAt'>): Promise<void>;
  update(gameId: string, updates: Partial<GameRecord>): Promise<void>;
}

export interface IGameRepository extends IGameReadRepository, IGameWriteRepository {}

// ----------------------------------------------------------------------------
// Snapshot
// ----------------------------------------------------------------------------

export interface SnapshotRecord {
  id: string;
  gameId: string;
  actionIndex: number;
  version: string;
  checksum: string;
  snapshotPayload: GameState;
  createdAt: Date;
}

export interface ISnapshotReadRepository {
  findLatestBefore(gameId: string, actionIndex: number): Promise<SnapshotRecord | null>;
}

export interface ISnapshotWriteRepository {
  save(snapshot: Omit<SnapshotRecord, 'createdAt'>): Promise<void>;
}

export interface ISnapshotRepository extends ISnapshotReadRepository, ISnapshotWriteRepository {}

// ----------------------------------------------------------------------------
// Action & Events
// ----------------------------------------------------------------------------

export interface ActionRecord {
  id: string;
  gameId: string;
  actionIndex: number;
  clientActionPayload: ClientAction;
  createdAt: Date;
}

export interface EventRecord {
  id: string;
  gameId: string;
  actionId: string | null;
  sequenceNumber: number;
  eventPayload: GameEvent;
  createdAt: Date;
}

export interface IActionReadRepository {
  getActionsAfter(gameId: string, actionIndex: number): Promise<ActionRecord[]>;
}

export interface IActionWriteRepository {
  saveActionWithEvents(action: Omit<ActionRecord, 'createdAt'>, events: Omit<EventRecord, 'createdAt'>[]): Promise<void>;
  saveEvents(events: Omit<EventRecord, 'createdAt'>[]): Promise<void>;
}

export interface IActionRepository extends IActionReadRepository, IActionWriteRepository {}

// ----------------------------------------------------------------------------
// Replay
// ----------------------------------------------------------------------------

export interface ReplayMetadata {
  gameId: string;
  totalActions: number;
  durationSeconds: number;
  playerCount: number;
  recordedAt: Date;
}

export interface ReplayData {
  metadata: ReplayMetadata;
  initialSnapshot: SnapshotRecord;
  actions: ActionRecord[];
  events: EventRecord[];
}

export interface IReplayReadRepository {
  getMetadata(gameId: string): Promise<ReplayMetadata | null>;
  getFullReplay(gameId: string): Promise<ReplayData | null>;
}

export interface IReplayWriteRepository {
  saveMetadata(metadata: Omit<ReplayMetadata, 'recordedAt'>): Promise<void>;
}

export interface IReplayRepository extends IReplayReadRepository, IReplayWriteRepository {}

// ----------------------------------------------------------------------------
// Database / Unit of Work
// ----------------------------------------------------------------------------

export interface IUnitOfWork {
  rooms: IRoomRepository;
  games: IGameRepository;
  snapshots: ISnapshotRepository;
  actions: IActionRepository;
  replays: IReplayRepository;
  
  /** Executes all repository interactions within a single database transaction */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
