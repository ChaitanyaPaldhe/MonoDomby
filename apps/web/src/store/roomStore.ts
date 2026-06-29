import { create } from 'zustand';

interface RoomState {
  roomId: string | null;
  players: string[]; // List of connected player IDs
  spectators: string[];
  hostId: string | null;
  joinCode: string | null;
  
  setRoom: (roomId: string, joinCode?: string, hostId?: string) => void;
  addPlayer: (playerId: string) => void;
  removePlayer: (playerId: string) => void;
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
  
  setRoom: (roomId, joinCode, hostId) => set({ roomId, joinCode: joinCode || null, hostId: hostId || null }),
  addPlayer: (id) => set((state) => ({ players: state.players.includes(id) ? state.players : [...state.players, id] })),
  removePlayer: (id) => set((state) => ({ players: state.players.filter(p => p !== id) })),
  addSpectator: (id) => set((state) => ({ spectators: state.spectators.includes(id) ? state.spectators : [...state.spectators, id] })),
  removeSpectator: (id) => set((state) => ({ spectators: state.spectators.filter(p => p !== id) })),
  clearRoom: () => set({ roomId: null, players: [], spectators: [], hostId: null, joinCode: null }),
}));
