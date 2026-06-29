import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  ping: number;
  playerId: string | null;
  error: string | null;
  
  setStatus: (status: ConnectionStatus) => void;
  setPing: (ping: number) => void;
  setPlayerId: (id: string | null) => void;
  setError: (error: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  ping: 0,
  playerId: null,
  error: null,
  
  setStatus: (status) => set({ status }),
  setPing: (ping) => set({ ping }),
  setPlayerId: (playerId) => set({ playerId }),
  setError: (error) => set({ error }),
}));
