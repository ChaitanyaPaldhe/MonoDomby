import { ClientAction, GameEvent, GameState, PlayerId } from '@monopoly/shared';

// ============================================================================
// Client-to-Server Events
// ============================================================================

export interface ClientToServerEvents {
  create_room: (payload: { roomId: string }, callback?: (response: SocketResponse) => void) => void;
  join_room: (payload: { roomId: string }, callback?: (response: SocketResponse) => void) => void;
  leave_room: (payload: { roomId: string }, callback?: (response: SocketResponse) => void) => void;
  reconnect: (payload: { roomId: string }, callback?: (response: SocketResponse) => void) => void;
  spectate_room: (payload: { roomId: string }, callback?: (response: SocketResponse) => void) => void;
  start_game: (payload: { roomId: string }, callback?: (response: SocketResponse) => void) => void;
  game_action: (payload: { roomId: string; action: ClientAction }, callback?: (response: SocketResponse) => void) => void;
  heartbeat: () => void;
  chat_message: (payload: { roomId: string; message: string }, callback?: (response: SocketResponse) => void) => void;
}

// ============================================================================
// Server-to-Client Events
// ============================================================================

export interface ServerToClientEvents {
  room_created: (payload: { roomId: string }) => void;
  room_joined: (payload: { roomId: string; state?: GameState; players: string[]; roomState: string }) => void;
  room_updated: (payload: { roomId: string }) => void;
  player_joined: (payload: { roomId: string; playerId: PlayerId }) => void;
  player_left: (payload: { roomId: string; playerId: PlayerId }) => void;
  spectator_joined: (payload: { roomId: string; playerId: PlayerId }) => void;
  spectator_left: (payload: { roomId: string; playerId: PlayerId }) => void;
  action_applied: (payload: { roomId: string; action: ClientAction; events: readonly GameEvent[]; state?: GameState }) => void;
  game_state: (payload: { roomId: string; state: GameState }) => void;
  replay_chunk: (payload: { roomId: string; actions: any[] }) => void; // Using any[] here as a stub for future Replay integration
  timer_updated: (payload: { roomId: string; timerId: string; remainingMs: number }) => void;
  error: (payload: SocketErrorPayload) => void;
}

// ============================================================================
// Inter-Server Events (For future scaling)
// ============================================================================

export interface InterServerEvents {
  ping: () => void;
}

// ============================================================================
// Socket Data (Attached to the socket instance via middleware)
// ============================================================================

export interface SocketData {
  playerId: PlayerId;
  isAuthenticated: boolean;
}

// ============================================================================
// Shared Utilities
// ============================================================================

export interface SocketResponse {
  success: boolean;
  error?: SocketErrorPayload;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}
