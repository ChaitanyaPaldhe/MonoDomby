import { create } from 'zustand';

interface UiState {
  showDebugOverlay: boolean;
  activeModal: 'NONE' | 'TRADE' | 'AUCTION' | 'MORTGAGE' | 'BUILD' | 'ERROR';
  errorMessage: string | null;
  
  toggleDebug: () => void;
  setActiveModal: (modal: UiState['activeModal']) => void;
  showError: (message: string) => void;
  clearError: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  showDebugOverlay: false,
  activeModal: 'NONE',
  errorMessage: null,
  
  toggleDebug: () => set((state) => ({ showDebugOverlay: !state.showDebugOverlay })),
  setActiveModal: (modal) => set({ activeModal: modal }),
  showError: (message) => set({ errorMessage: message, activeModal: 'ERROR' }),
  clearError: () => set({ errorMessage: null, activeModal: 'NONE' }),
}));
