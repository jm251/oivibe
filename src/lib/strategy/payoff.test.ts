import { computeStrategySnapshot, templateLegs } from "@/lib/strategy/payoff";

describe("strategy payoff", () => {
  it("returns payoff points and greeks", () => {
    const legs = templateLegs("longStraddle", 22500, 50);
    const result = computeStrategySnapshot({
      spot: 22500,
      iv: 12,
      lotSize: 50,
      legs
    });

    expect(result.payoffSeries.length).toBeGreaterThan(10);
    expect(Array.isArray(result.breakEvens)).toBe(true);
    expect(Number.isFinite(result.maxProfit)).toBe(true);
    expect(Number.isFinite(result.maxLoss)).toBe(true);
  });
});