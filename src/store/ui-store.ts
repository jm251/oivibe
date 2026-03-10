import { create } from "zustand";

interface UiState {
  volSurfaceEnabled: boolean;
  volSurfaceHighQuality: boolean;
  showChainPanel: boolean;
  setVolSurfaceEnabled: (enabled: boolean) => void;
  setVolSurfaceQuality: (highQuality: boolean) => void;
  setShowChainPanel: (visible: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  volSurfaceEnabled: true,
  volSurfaceHighQuality: false,
  showChainPanel: true,
  setVolSurfaceEnabled: (volSurfaceEnabled) => set({ volSurfaceEnabled }),
  setVolSurfaceQuality: (volSurfaceHighQuality) => set({ volSurfaceHighQuality }),
  setShowChainPanel: (showChainPanel) => set({ showChainPanel })
}));