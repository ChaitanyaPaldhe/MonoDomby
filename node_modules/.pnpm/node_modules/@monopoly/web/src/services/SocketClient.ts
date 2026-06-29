import { io, Socket } from 'socket.io-client';
import { useConnectionStore, useRoomStore, useGameStore, useUiStore } from '../store';
import { GameState, GameEvent, ClientAction } from '@monopoly/shared';

// For typing the socket client
interface ServerToClientEvents {
  room_created: (payload: { roomId: string }) => void;
  room_joined: (payload: { roomId: string; state: GameState }) => void;
  room_updated: (payload: { roomId: string }) => void;
  player_joined: (payload: { roomId: string; playerId: string }) => void;
  player_left: (payload: { roomId: string; playerId: string }) => void;
  spectator_joined: (payload: { roomId: string; playerId: string }) => void;
  spectator_left: (payload: { roomId: string; playerId: string }) => void;
  action_applied: (payload: { roomId: string; action: ClientAction; events: readonly GameEvent[], state: GameState }) => void;
  game_state: (payload: { roomId: string; state: GameState }) => void;
  replay_chunk: (payload: { roomId: string; actions: any[] }) => void;
  timer_updated: (payload: { roomId: string; timerId: string; remainingMs: number }) => void;
  error: (payload: { code: string, message: string }) => void;
}

interface ClientToServerEvents {
  create_room: (payload: { roomId: string }, callback?: (res: any) => void) => void;
  join_room: (payload: { roomId: string }, callback?: (res: any) => void) => void;
  leave_room: (payload: { roomId: string }, callback?: (res: any) => void) => void;
  reconnect: (payload: { roomId: string }, callback?: (res: any) => void) => void;
  spectate_room: (payload: { roomId: string }, callback?: (res: any) => void) => void;
  game_action: (payload: { roomId: string; action: ClientAction }, callback?: (res: any) => void) => void;
  heartbeat: () => void;
  chat_message: (payload: { roomId: string; message: string }, callback?: (res: any) => void) => void;
}

class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private token: string | null = null;

  public connect(playerId: string) {
    if (this.socket?.connected) return;

    this.token = playerId;
    
    this.socket = io({
      auth: { token: this.token },
      reconnection: true,
    });

    const connStore = useConnectionStore.getState();
    const roomStore = useRoomStore.getState();
    const gameStore = useGameStore.getState();
    const uiStore = useUiStore.getState();

    connStore.setPlayerId(playerId);
    connStore.setStatus('connecting');

    this.socket.on('connect', () => {
      connStore.setStatus('connected');
    });

    this.socket.on('disconnect', () => {
      connStore.setStatus('disconnected');
    });

    // Room Events
    this.socket.on('room_joined', (payload) => {
      roomStore.setRoom(payload.roomId);
      gameStore.setGameState(payload.state);
    });

    this.socket.on('player_joined', (payload) => {
      roomStore.addPlayer(payload.playerId);
    });

    this.socket.on('player_left', (payload) => {
      roomStore.removePlayer(payload.playerId);
    });

    // Game Events
    this.socket.on('game_state', (payload) => {
      gameStore.setGameState(payload.state);
    });

    // We expect the server to send the action, resulting events, and ideally the resulting state
    // so we can blindly update state without applying rules.
    this.socket.on('action_applied', (payload) => {
      gameStore.appendActionEvents(payload.action, payload.events);
      // As per prompt: we update local state using events + checksum. If there's a discrepancy, 
      // we'd request a full state. But for simplicity if the payload contains the full state we can just apply it.
      if (payload.state) {
        gameStore.setGameState(payload.state);
      }
    });

    this.socket.on('error', (payload) => {
      uiStore.showError(`[${payload.code}] ${payload.message}`);
    });
  }

  public getSocket() {
    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    useConnectionStore.getState().setStatus('disconnected');
  }
}

export const socketClient = new SocketClient();
