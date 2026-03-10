import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/market/service", () => ({
  sanitizeSymbol: (value: string) => value,
  resolveOptionChainSnapshot: vi.fn()
}));

import { GET } from "@/app/api/option-chain/route";
import { resolveOptionChainSnapshot } from "@/lib/market/service";

describe("GET /api/option-chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized payload", async () => {
    vi.mocked(resolveOptionChainSnapshot).mockResolvedValue({
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
      updatedAt: new Date().toISOString()
    });

    const response = await GET(
      new Request("http://localhost:3000/api/option-chain?symbol=NIFTY&expiry=2026-03-26")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ mode: "mock", symbol: "NIFTY", spot: 22500 });
  });
});