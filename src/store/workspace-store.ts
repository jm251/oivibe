import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspaceMode = "terminal" | "research";
export type TerminalChartView = "timeline" | "flow" | "walls";
export type TerminalDockView = "buildup" | "uoa" | "replay" | "pulse";
export type ChainWindow = "atm-8" | "atm-16" | "atm-24" | "all";
export type ChainPreset = "quick" | "pro";

interface WorkspaceState {
  workspaceMode: WorkspaceMode;
  terminalChartView: TerminalChartView;
  terminalDockView: TerminalDockView;
  chainWindow: ChainWindow;
  chainPreset: ChainPreset;
  selectedStrike: number | null;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setTerminalChartView: (view: TerminalChartView) => void;
  setTerminalDockView: (view: TerminalDockView) => void;
  setChainWindow: (window: ChainWindow) => void;
  setChainPreset: (preset: ChainPreset) => void;
  setSelectedStrike: (strike: number | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceMode: "terminal",
      terminalChartView: "timeline",
      terminalDockView: "buildup",
      chainWindow: "atm-16",
      chainPreset: "pro",
      selectedStrike: null,
      setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
      setTerminalChartView: (terminalChartView) => set({ terminalChartView }),
      setTerminalDockView: (terminalDockView) => set({ terminalDockView }),
      setChainWindow: (chainWindow) => set({ chainWindow }),
      setChainPreset: (chainPreset) => set({ chainPreset }),
      setSelectedStrike: (selectedStrike) => set({ selectedStrike })
    }),
    {
      name: "oi-vibe-workspace"
    }
  )
);
