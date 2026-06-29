import { create } from 'zustand';
import { GameState, GameEvent, ClientAction } from '@monopoly/shared';

interface GameStoreState {
  gameState: GameState | null;
  eventLog: { action: ClientAction | null, events: readonly GameEvent[] }[];
  
  setGameState: (state: GameState) => void;
  appendActionEvents: (action: ClientAction | null, events: readonly GameEvent[]) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: null,
  eventLog: [],
  
  setGameState: (gameState) => set({ gameState }),
  
  appendActionEvents: (action, events) => set((state) => ({ 
    eventLog: [...state.eventLog, { action, events }] 
  })),
  
  clearGame: () => set({ gameState: null, eventLog: [] }),
}));
