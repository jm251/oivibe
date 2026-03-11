import { create } from "zustand";

import { applyTickUpdates } from "@/lib/market/analytics";
import { ChainAggregates, OptionChainRow, SupportedSymbol, TickDelta } from "@/lib/types";

interface TimelinePoint {
  time: number;
  spot: number;
  callOi: number;
  putOi: number;
}

interface MarketState {
  symbol: SupportedSymbol;
  expiry: string;
  mode: "live" | "mock";
  connected: boolean;
  degraded: boolean;
  message?: string;
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
  spot: number;
  updatedAt: string;
  lastTickAt: string | null;
  timeline: TimelinePoint[];
  setSymbol: (symbol: SupportedSymbol) => void;
  setExpiry: (expiry: string) => void;
  setConnection: (connection: {
    connected: boolean;
    mode: "live" | "mock";
    degraded?: boolean;
    message?: string;
  }) => void;
  applySnapshot: (snapshot: {
    mode: "live" | "mock";
    expiry: string;
    rows: OptionChainRow[];
    aggregates: ChainAggregates;
    spot: number;
    updatedAt: string;
    degraded?: boolean;
    message?: string;
  }) => void;
  applyTick: (payload: {
    updates: TickDelta[];
    aggregates: ChainAggregates;
    spot: number;
    ts: string;
  }) => void;
}

const emptyAggregates: ChainAggregates = {
  totalCallOi: 0,
  totalPutOi: 0,
  totalCallVolume: 0,
  totalPutVolume: 0,
  pcrOi: 0,
  pcrVolume: 0,
  topCallWalls: [],
  topPutWalls: [],
  strongestBuildup: null,
  strongestUnwinding: null
};

function appendTimeline(
  timeline: TimelinePoint[],
  point: Omit<TimelinePoint, "time">,
  ts: string
): TimelinePoint[] {
  const next = [
    ...timeline,
    {
      time: Math.floor(new Date(ts).getTime() / 1000),
      ...point
    }
  ];
  return next.slice(-240);
}

export const useMarketStore = create<MarketState>((set) => ({
  symbol: "NIFTY",
  expiry: "",
  mode: "mock",
  connected: false,
  degraded: false,
  message: undefined,
  rows: [],
  aggregates: emptyAggregates,
  spot: 0,
  updatedAt: "",
  lastTickAt: null,
  timeline: [],
  setSymbol: (symbol) => set({ symbol }),
  setExpiry: (expiry) => set({ expiry }),
  setConnection: (connection) =>
    set({
      connected: connection.connected,
      mode: connection.mode,
      degraded: connection.degraded ?? false,
      message: connection.message
    }),
  applySnapshot: (snapshot) =>
    set((state) => ({
      mode: snapshot.mode,
      connected: snapshot.mode === "live",
      degraded: snapshot.degraded ?? false,
      message: snapshot.message,
      expiry: snapshot.expiry,
      rows: snapshot.rows,
      aggregates: snapshot.aggregates,
      spot: snapshot.spot,
      updatedAt: snapshot.updatedAt,
      lastTickAt: snapshot.updatedAt,
      timeline: appendTimeline(
        state.timeline,
        {
          spot: snapshot.spot,
          callOi: snapshot.aggregates.totalCallOi,
          putOi: snapshot.aggregates.totalPutOi
        },
        snapshot.updatedAt
      )
    })),
  applyTick: (payload) =>
    set((state) => {
      const rows = applyTickUpdates(state.rows, payload.updates);
      return {
        rows,
        aggregates: payload.aggregates,
        spot: payload.spot,
        updatedAt: payload.ts,
        lastTickAt: payload.ts,
        timeline: appendTimeline(
          state.timeline,
          {
            spot: payload.spot,
            callOi: payload.aggregates.totalCallOi,
            putOi: payload.aggregates.totalPutOi
          },
          payload.ts
        )
      };
    })
}));
