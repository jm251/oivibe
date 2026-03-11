import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session/runtime", () => ({
  resolveRuntimeCredentials: vi.fn()
}));

vi.mock("@/lib/upstox/rest", () => ({
  fetchUpstoxExpiries: vi.fn(),
  fetchUpstoxOptionChainSnapshot: vi.fn()
}));

vi.mock("@/lib/mock/simulator", () => ({
  getMockExpiries: vi.fn(() => ["2026-03-26"]),
  mockMarketEngine: {
    getSnapshot: vi.fn(() => ({
      mode: "mock",
      symbol: "NIFTY",
      expiry: "2026-03-26",
      spot: 22500,
      rows: [],
      aggregates: {
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
      },
      updatedAt: "2026-03-11T00:00:00.000Z"
    }))
  }
}));

import {
  resetMarketServiceCaches,
  resolveExpiries,
  resolveOptionChainSnapshot
} from "@/lib/market/service";
import { resolveRuntimeCredentials } from "@/lib/session/runtime";
import {
  fetchUpstoxExpiries,
  fetchUpstoxOptionChainSnapshot
} from "@/lib/upstox/rest";

function createRow() {
  return [
    {
      strike: 24250,
      call: {
        securityId: "NSE_FO|111",
        strike: 24250,
        optionType: "CALL" as const,
        ltp: 121.5,
        oi: 8000,
        previousOi: 7600,
        deltaOi: 400,
        volume: 1200,
        iv: 14.6,
        bid: 121,
        ask: 122,
        greeks: {
          delta: 0.4,
          gamma: 0.02,
          theta: -11,
          vega: 8
        }
      },
      put: {
        securityId: "NSE_FO|222",
        strike: 24250,
        optionType: "PUT" as const,
        ltp: 109.4,
        oi: 9100,
        previousOi: 9000,
        deltaOi: 100,
        volume: 980,
        iv: 13.2,
        bid: 109.1,
        ask: 109.8,
        greeks: {
          delta: -0.44,
          gamma: 0.02,
          theta: -10.4,
          vega: 7.9
        }
      }
    }
  ];
}

describe("market service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMarketServiceCaches();
    vi.mocked(resolveRuntimeCredentials).mockResolvedValue({
      source: "env",
      credentials: {
        accessToken: "token-live"
      }
    });
  });

  it("reuses the last live snapshot instead of switching to mock", async () => {
    vi.mocked(fetchUpstoxOptionChainSnapshot)
      .mockResolvedValueOnce({
        expiry: "2026-03-26",
        spot: 24261.6,
        rows: createRow(),
        subscriptionKeys: ["NSE_INDEX|Nifty 50", "NSE_FO|111", "NSE_FO|222"],
        underlyingKey: "NSE_INDEX|Nifty 50"
      })
      .mockRejectedValueOnce(new Error("401 token expired"));

    const fresh = await resolveOptionChainSnapshot("NIFTY", "2026-03-26");
    const cached = await resolveOptionChainSnapshot("NIFTY", "2026-03-26");

    expect(fresh.mode).toBe("live");
    expect(fresh.degraded).toBeUndefined();
    expect(cached.mode).toBe("live");
    expect(cached.degraded).toBe(true);
    expect(cached.rows).toEqual(fresh.rows);
    expect(cached.message).toContain("last successful live snapshot");
  });

  it("keeps live mode and falls back to local expiries on refresh failure", async () => {
    vi.mocked(fetchUpstoxExpiries).mockRejectedValue(new Error("429 rate limit"));

    const result = await resolveExpiries("NIFTY");

    expect(result.mode).toBe("live");
    expect(result.degraded).toBe(true);
    expect(result.expiries).toEqual(["2026-03-26"]);
    expect(result.message).toContain("Upstox expiry refresh failed");
  });
});
