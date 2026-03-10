import { applyTickUpdates, computeAggregates } from "@/lib/market/analytics";
import { OptionChainRow } from "@/lib/types";

const rows: OptionChainRow[] = [
  {
    strike: 22500,
    call: {
      securityId: "CE-1",
      strike: 22500,
      optionType: "CALL",
      ltp: 100,
      oi: 10000,
      previousOi: 9700,
      deltaOi: 300,
      volume: 1000,
      iv: 12,
      bid: 99,
      ask: 101,
      greeks: { delta: 0.4, gamma: 0.03, theta: -12, vega: 7 }
    },
    put: {
      securityId: "PE-1",
      strike: 22500,
      optionType: "PUT",
      ltp: 90,
      oi: 14000,
      previousOi: 13600,
      deltaOi: 400,
      volume: 1200,
      iv: 13,
      bid: 89,
      ask: 91,
      greeks: { delta: -0.5, gamma: 0.03, theta: -11, vega: 8 }
    }
  }
];

describe("market analytics", () => {
  it("computes aggregates and pcr", () => {
    const agg = computeAggregates(rows);
    expect(agg.totalCallOi).toBe(10000);
    expect(agg.totalPutOi).toBe(14000);
    expect(agg.pcrOi).toBeCloseTo(1.4, 5);
    expect(agg.topCallWalls[0]?.strike).toBe(22500);
  });

  it("applies tick updates with delta oi", () => {
    const next = applyTickUpdates(rows, [
      { securityId: "CE-1", ltp: 105, volume: 1300, oi: 10250, deltaOi: 250 }
    ]);
    expect(next[0]?.call.oi).toBe(10250);
    expect(next[0]?.call.previousOi).toBe(10000);
    expect(next[0]?.call.deltaOi).toBe(250);
  });
});