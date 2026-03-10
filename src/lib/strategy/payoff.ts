import { OptionLeg, StrategySnapshot } from "@/lib/types";
import { round } from "@/lib/utils";

interface ComputeInput {
  spot: number;
  iv: number;
  lotSize: number;
  legs: OptionLeg[];
}

function sideMultiplier(side: OptionLeg["side"]) {
  return side === "BUY" ? 1 : -1;
}

function payoffForLeg(expirySpot: number, leg: OptionLeg) {
  const intrinsic =
    leg.optionType === "CALL"
      ? Math.max(0, expirySpot - leg.strike)
      : Math.max(0, leg.strike - expirySpot);

  const side = sideMultiplier(leg.side);
  const pnlPerUnit = intrinsic - leg.premium;
  return side * pnlPerUnit * leg.quantity * leg.lotSize;
}

function solveBreakEven(payoff: { spot: number; pnl: number }[]) {
  const values: number[] = [];

  for (let i = 1; i < payoff.length; i += 1) {
    const prev = payoff[i - 1];
    const curr = payoff[i];
    if (!prev || !curr) continue;

    if (prev.pnl === 0) {
      values.push(prev.spot);
      continue;
    }

    if (prev.pnl * curr.pnl < 0) {
      const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
      const point = prev.spot + (curr.spot - prev.spot) * ratio;
      values.push(round(point, 2));
    }
  }

  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function computeStrategySnapshot({ spot, iv, lotSize, legs }: ComputeInput): StrategySnapshot {
  if (!legs.length) {
    return {
      payoffSeries: [],
      breakEvens: [],
      maxProfit: 0,
      maxLoss: 0,
      greeks: {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0
      }
    };
  }

  const strikes = legs.map((leg) => leg.strike);
  const minStrike = Math.min(...strikes, spot * 0.8);
  const maxStrike = Math.max(...strikes, spot * 1.2);
  const step = Math.max(5, Math.round(spot * 0.002));

  const payoffSeries: { spot: number; pnl: number }[] = [];
  for (let price = Math.floor(minStrike * 0.85); price <= Math.ceil(maxStrike * 1.15); price += step) {
    const pnl = legs.reduce((total, leg) => total + payoffForLeg(price, leg), 0);
    payoffSeries.push({ spot: price, pnl: round(pnl, 2) });
  }

  const breakEvens = solveBreakEven(payoffSeries);
  const pnlValues = payoffSeries.map((point) => point.pnl);

  const greeks = legs.reduce(
    (acc, leg) => {
      const side = sideMultiplier(leg.side) * leg.quantity * leg.lotSize;
      acc.delta += (leg.greeks?.delta ?? 0) * side;
      acc.gamma += (leg.greeks?.gamma ?? 0) * side;
      acc.theta += (leg.greeks?.theta ?? 0) * side;
      acc.vega += (leg.greeks?.vega ?? iv * 0.02) * side;
      return acc;
    },
    { delta: 0, gamma: 0, theta: 0, vega: 0 }
  );

  return {
    payoffSeries,
    breakEvens,
    maxProfit: round(Math.max(...pnlValues), 2),
    maxLoss: round(Math.min(...pnlValues), 2),
    greeks: {
      delta: round(greeks.delta, 2),
      gamma: round(greeks.gamma, 3),
      theta: round(greeks.theta, 2),
      vega: round(greeks.vega, 2)
    }
  };
}

export type StrategyTemplate = "longStraddle" | "shortStrangle" | "bullCallSpread";

export function templateLegs(template: StrategyTemplate, spot: number, lotSize: number): OptionLeg[] {
  const rounded = Math.round(spot / 50) * 50;

  if (template === "shortStrangle") {
    return [
      {
        id: crypto.randomUUID(),
        side: "SELL",
        optionType: "CALL",
        strike: rounded + 300,
        premium: 95,
        quantity: 1,
        iv: 14,
        daysToExpiry: 6,
        lotSize
      },
      {
        id: crypto.randomUUID(),
        side: "SELL",
        optionType: "PUT",
        strike: rounded - 300,
        premium: 102,
        quantity: 1,
        iv: 14,
        daysToExpiry: 6,
        lotSize
      }
    ];
  }

  if (template === "bullCallSpread") {
    return [
      {
        id: crypto.randomUUID(),
        side: "BUY",
        optionType: "CALL",
        strike: rounded,
        premium: 130,
        quantity: 1,
        iv: 12,
        daysToExpiry: 6,
        lotSize
      },
      {
        id: crypto.randomUUID(),
        side: "SELL",
        optionType: "CALL",
        strike: rounded + 250,
        premium: 52,
        quantity: 1,
        iv: 12,
        daysToExpiry: 6,
        lotSize
      }
    ];
  }

  return [
    {
      id: crypto.randomUUID(),
      side: "BUY",
      optionType: "CALL",
      strike: rounded,
      premium: 120,
      quantity: 1,
      iv: 13,
      daysToExpiry: 6,
      lotSize
    },
    {
      id: crypto.randomUUID(),
      side: "BUY",
      optionType: "PUT",
      strike: rounded,
      premium: 118,
      quantity: 1,
      iv: 13,
      daysToExpiry: 6,
      lotSize
    }
  ];
}