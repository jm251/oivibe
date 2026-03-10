import { create } from "zustand";

export type PlanTier = "free" | "pro" | "enterprise";

interface PlanState {
  tier: PlanTier;
  apiCallsToday: number;
  apiCallsLimit: number;
  activatedAt: string | null;
  expiresAt: string | null;
  setTier: (tier: PlanTier) => void;
  incrementApiCalls: () => void;
  resetDailyCalls: () => void;
  isFeatureLocked: (feature: LockedFeature) => boolean;
  canMakeApiCall: () => boolean;
}

export type LockedFeature =
  | "strategy-lab"
  | "vol-surface"
  | "full-chain"
  | "live-data"
  | "multi-symbol"
  | "export-csv"
  | "alerts";

const PLAN_LIMITS: Record<PlanTier, { apiCalls: number; features: LockedFeature[] }> = {
  free: {
    apiCalls: 50,
    features: []
  },
  pro: {
    apiCalls: 5000,
    features: ["strategy-lab", "vol-surface", "full-chain", "live-data", "export-csv"]
  },
  enterprise: {
    apiCalls: 999999,
    features: [
      "strategy-lab",
      "vol-surface",
      "full-chain",
      "live-data",
      "multi-symbol",
      "export-csv",
      "alerts"
    ]
  }
};

function loadPersistedPlan(): { tier: PlanTier; activatedAt: string | null; expiresAt: string | null } {
  if (typeof window === "undefined") return { tier: "free", activatedAt: null, expiresAt: null };
  try {
    const stored = localStorage.getItem("oi_vibe_plan");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        localStorage.removeItem("oi_vibe_plan");
        return { tier: "free", activatedAt: null, expiresAt: null };
      }
      return parsed;
    }
  } catch {}
  return { tier: "free", activatedAt: null, expiresAt: null };
}

function loadDailyCalls(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = localStorage.getItem("oi_vibe_api_calls");
    if (stored) {
      const parsed = JSON.parse(stored);
      const today = new Date().toDateString();
      if (parsed.date === today) return parsed.count;
    }
  } catch {}
  return 0;
}

function persistDailyCalls(count: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "oi_vibe_api_calls",
    JSON.stringify({ date: new Date().toDateString(), count })
  );
}

export const usePlanStore = create<PlanState>((set, get) => {
  const persisted = loadPersistedPlan();
  return {
    tier: persisted.tier,
    apiCallsToday: loadDailyCalls(),
    apiCallsLimit: PLAN_LIMITS[persisted.tier].apiCalls,
    activatedAt: persisted.activatedAt,
    expiresAt: persisted.expiresAt,

    setTier: (tier) => {
      const now = new Date();
      const expires = new Date(now);
      if (tier === "pro") expires.setDate(expires.getDate() + 30);
      if (tier === "enterprise") expires.setDate(expires.getDate() + 365);
      const activatedAt = tier === "free" ? null : now.toISOString();
      const expiresAt = tier === "free" ? null : expires.toISOString();

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "oi_vibe_plan",
          JSON.stringify({ tier, activatedAt, expiresAt })
        );
      }

      set({
        tier,
        apiCallsLimit: PLAN_LIMITS[tier].apiCalls,
        activatedAt,
        expiresAt
      });
    },

    incrementApiCalls: () => {
      const next = get().apiCallsToday + 1;
      persistDailyCalls(next);
      set({ apiCallsToday: next });
    },

    resetDailyCalls: () => {
      persistDailyCalls(0);
      set({ apiCallsToday: 0 });
    },

    isFeatureLocked: (feature) => {
      const { tier } = get();
      return !PLAN_LIMITS[tier].features.includes(feature);
    },

    canMakeApiCall: () => {
      const { apiCallsToday, apiCallsLimit } = get();
      return apiCallsToday < apiCallsLimit;
    }
  };
});
