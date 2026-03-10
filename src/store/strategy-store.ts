import { create } from "zustand";

import { OptionLeg } from "@/lib/types";

interface StrategyState {
  template: "longStraddle" | "shortStrangle" | "bullCallSpread";
  quantity: number;
  legs: OptionLeg[];
  setTemplate: (template: StrategyState["template"]) => void;
  setQuantity: (quantity: number) => void;
  setLegs: (legs: OptionLeg[]) => void;
  addLeg: (leg: OptionLeg) => void;
  updateLeg: (id: string, patch: Partial<OptionLeg>) => void;
  removeLeg: (id: string) => void;
}

export const useStrategyStore = create<StrategyState>((set) => ({
  template: "longStraddle",
  quantity: 1,
  legs: [],
  setTemplate: (template) => set({ template }),
  setQuantity: (quantity) => set({ quantity }),
  setLegs: (legs) => set({ legs }),
  addLeg: (leg) => set((state) => ({ legs: [...state.legs, leg] })),
  updateLeg: (id, patch) =>
    set((state) => ({
      legs: state.legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg))
    })),
  removeLeg: (id) =>
    set((state) => ({
      legs: state.legs.filter((leg) => leg.id !== id)
    }))
}));