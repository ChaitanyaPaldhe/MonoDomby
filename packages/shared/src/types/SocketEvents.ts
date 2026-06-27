// =============================================================================
// SocketEvents.ts
// Typed Socket.IO event maps for both client-to-server and server-to-client.
// Import these types into Socket.IO server and client setup for full type safety.
//
// Naming convention: DOMAIN:VERB_NOUN (uppercase)
// Client → Server events: CLIENT:*
// Server → Client events: ROOM:* | GAME:* | AUCTION:* | TRADE:*
// =============================================================================

import type { ClientAction } from './Action.js';
import type { GameEvent } from './Event.js';
import type { GameState, AuctionState, TradeState, PlayerId, RoomId, GameSettings } from './GameState.js';
import type { ErrorCode } from './Enums.js';

// ---------------------------------------------------------------------------
// Supporting Types
// ---------------------------------------------------------------------------

/** Lightweight player info shown in the lobby. */
export interface PlayerLobbyInfo {
  readonly playerId: PlayerId;
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly isReady: boolean;
  readonly isHost: boolean;
  readonly tokenId: string;
}

/** Lightweight room snapshot sent on join. */
export interface RoomSnapshot {
  readonly roomId: RoomId;
  readonly code: string;
  readonly status: string;
  readonly mapId: string;
  readonly settings: GameSettings;
  readonly players: readonly PlayerLobbyInfo[];
  readonly hostId: PlayerId;
  readonly maxPlayers: number;
}

/** Action acknowledgement from server. */
export interface ActionAck {
  readonly actionId: string;
  /** Server timestamp of processing. */
  readonly ts: number;
  /** State version after this action was applied. */
  readonly stateVersion: number;
}

/** Action rejection details. */
export interface ActionRejection {
  readonly actionId: string;
  readonly code: ErrorCode;
  readonly reason: string;
}

/** Full reconnect payload. */
export interface ReconnectPayload {
  readonly state: GameState;
  /** Last N events for context display on reconnect. */
  readonly recentEvents: readonly GameEvent[];
}

/** JSON Patch operation (RFC 6902). */
export interface JsonPatchOperation {
  readonly op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  readonly path: string;
  readonly value?: unknown;
  readonly from?: string;
}

/** Room-level error payload. */
export interface RoomError {
  readonly code: string;
  readonly message: string;
}

/** Auction countdown update. */
export interface AuctionTimerUpdate {
  readonly endsAt: number;
}

/** Trade summary for TRADE_EXECUTED event display. */
export interface TradeSummary {
  readonly tradeId: string;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Client → Server Events
// ---------------------------------------------------------------------------

/**
 * All events the client can emit to the server.
 * Used as the first generic parameter to Socket.IO `Server<ClientToServerEvents, ...>`.
 */
export interface ClientToServerEvents {
  'CLIENT:AUTHENTICATE': (payload: { token: string }, ack: (success: boolean) => void) => void;
  'CLIENT:JOIN_ROOM': (payload: { roomId: RoomId; displayName: string; tokenId: string }) => void;
  'CLIENT:LEAVE_ROOM': (payload: { roomId: RoomId }) => void;
  'CLIENT:SPECTATE_ROOM': (payload: { roomId: RoomId }) => void;
  /** All in-game actions flow through this single channel. */
  'CLIENT:GAME_ACTION': (action: ClientAction, ack: (result: ActionAck | ActionRejection) => void) => void;
  'CLIENT:RECONNECT': (payload: { roomId: RoomId; token: string }) => void;
  /** Request a full state resync (e.g., suspected desync). */
  'CLIENT:REQUEST_FULL_STATE': (payload: { roomId: RoomId }) => void;
  'CLIENT:HEARTBEAT': (payload: { ts: number }) => void;
}

// ---------------------------------------------------------------------------
// Server → Client Events
// ---------------------------------------------------------------------------

/**
 * All events the server can emit to clients.
 * Used as the second generic parameter to Socket.IO `Server<..., ServerToClientEvents>`.
 */
export interface ServerToClientEvents {
  // Room lifecycle
  'ROOM:JOINED': (payload: { room: RoomSnapshot; playerId: PlayerId }) => void;
  'ROOM:PLAYER_JOINED': (payload: { player: PlayerLobbyInfo }) => void;
  'ROOM:PLAYER_LEFT': (payload: { playerId: PlayerId }) => void;
  'ROOM:PLAYER_READY': (payload: { playerId: PlayerId }) => void;
  'ROOM:SETTINGS_UPDATED': (payload: { settings: GameSettings }) => void;
  'ROOM:HOST_MIGRATED': (payload: { newHostId: PlayerId; previousHostId: PlayerId }) => void;
  'ROOM:GAME_STARTING': (payload: { countdown: number }) => void;
  'ROOM:ERROR': (payload: RoomError) => void;

  // Game state
  /** Full state. Only sent on initial join and explicit reconnect. Never during normal play. */
  'GAME:FULL_STATE': (state: GameState) => void;
  /**
   * Incremental state update (JSON Patch RFC 6902).
   * The primary broadcast mechanism. Typically 50–200 bytes per action.
   */
  'GAME:STATE_PATCH': (patches: readonly JsonPatchOperation[], stateVersion: number) => void;
  /** A game event (fact) to display in the event feed. */
  'GAME:EVENT': (event: GameEvent) => void;
  /** Action was successfully processed. */
  'GAME:ACTION_ACK': (ack: ActionAck) => void;
  /** Action was rejected. Only sent to the submitting client. */
  'GAME:ACTION_REJECTED': (rejection: ActionRejection) => void;
  /** Full state + recent events on reconnect. */
  'GAME:RECONNECTED': (payload: ReconnectPayload) => void;

  // Auction (room-wide)
  'AUCTION:STARTED': (auction: AuctionState) => void;
  'AUCTION:BID_PLACED': (payload: { playerId: PlayerId; amount: number; newEndsAt: number }) => void;
  'AUCTION:TIMER_UPDATE': (payload: AuctionTimerUpdate) => void;
  'AUCTION:EXTENDED': (payload: { newEndsAt: number; extensionCount: number }) => void;
  'AUCTION:ENDED': (payload: { winnerId: PlayerId | null; amount: number; tileId: string }) => void;

  // Trade (private channels — sent to specific player sockets)
  'TRADE:RECEIVED': (trade: TradeState) => void;
  'TRADE:COUNTERED': (trade: TradeState) => void;
  'TRADE:ACCEPTED': (payload: { tradeId: string }) => void;
  'TRADE:REJECTED': (payload: { tradeId: string }) => void;
  'TRADE:CANCELLED': (payload: { tradeId: string }) => void;
  'TRADE:EXECUTED': (payload: TradeSummary) => void;

  // System
  'SYSTEM:PONG': (payload: { serverTs: number; clientTs: number }) => void;
}

// ---------------------------------------------------------------------------
// Inter-Server Events (for Socket.IO Redis adapter pub/sub)
// ---------------------------------------------------------------------------

/**
 * Events broadcast between server nodes via the Socket.IO Redis adapter.
 * Not seen by clients; used for horizontal scaling.
 */
export interface InterServerEvents {
  'SERVER:ROOM_STATE_CHANGED': (payload: { roomId: RoomId; version: number }) => void;
}

// ---------------------------------------------------------------------------
// Socket Data (per-socket metadata)
// ---------------------------------------------------------------------------

/**
 * Typed metadata attached to each Socket.IO socket instance.
 * Set in the auth middleware and available throughout the socket's lifetime.
 */
export interface SocketData {
  readonly userId: string;
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly isGuest: boolean;
  readonly roomId: RoomId | null;
  readonly isSpectator: boolean;
  /** Unix ms when the socket authenticated. */
  readonly authenticatedAt: number;
}
