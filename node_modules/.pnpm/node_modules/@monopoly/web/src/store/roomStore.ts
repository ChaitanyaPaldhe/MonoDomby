import { create } from 'zustand';

interface RoomState {
  roomId: string | null;
  players: string[]; // List of connected player IDs
  spectators: string[];
  hostId: string | null;
  joinCode: string | null;
  status: string | null;
  
  setRoom: (roomId: string, joinCode?: string, hostId?: string) => void;
  setStatus: (status: string) => void;
  addPlayer: (playerId: string) => void;
  removePlayer: (playerId: string) => void;
  setPlayers: (players: string[]) => void;
  addSpectator: (playerId: string) => void;
  removeSpectator: (playerId: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  players: [],
  spectators: [],
  hostId: null,
  joinCode: null,
  status: null,
  
  setRoom: (roomId, joinCode, hostId) => set({ roomId, joinCode: joinCode || null, hostId: hostId || null }),
  setStatus: (status) => set({ status }),
  addPlayer: (id) => set((state) => ({ players: state.players.includes(id) ? state.players : [...state.players, id] })),
  removePlayer: (id) => set((state) => ({ players: state.players.filter(p => p !== id) })),
  setPlayers: (players) => set({ players }),
  addSpectator: (id) => set((state) => ({ spectators: state.spectators.includes(id) ? state.spectators : [...state.spectators, id] })),
  removeSpectator: (id) => set((state) => ({ spectators: state.spectators.filter(p => p !== id) })),
  clearRoom: () => set({ roomId: null, players: [], spectators: [], hostId: null, joinCode: null, status: null }),
}));
