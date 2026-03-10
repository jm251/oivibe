import { UNDERLYINGS } from "@/lib/constants";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";
import { round } from "@/lib/utils";

// ─── Implied vs Actual Move Tracker ─────────────────────────────────────────

export interface ImpliedVsActualEntry {
  date: string;
  impliedMove: number;
  impliedMovePct: number;
  actualMove: number;
  actualMovePct: number;
  overUnder: "over" | "under" | "inline";
  accuracy: number; // how close implied was to actual (0-100%)
}

export function generateImpliedVsActualHistory(
  spot: number,
  symbol: SupportedSymbol
): ImpliedVsActualEntry[] {
  const entries: ImpliedVsActualEntry[] = [];
  const today = new Date();
  const seed = Math.floor(spot) % 1000;

  for (let i = 14; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dayHash = (seed + i * 97 + date.getDate() * 31) % 500;
    const baseMove = symbol === "BANKNIFTY" ? 350 : symbol === "FINNIFTY" ? 180 : 150;
    const impliedMove = round(baseMove + (dayHash - 250) * 0.4, 2);
    const impliedMovePct = round((impliedMove / spot) * 100, 2);

    // Actual move varies - sometimes exceeds, sometimes falls short
    const actualFactor = 0.4 + ((dayHash * 7) % 200) / 100;
    const actualMove = round(Math.abs(impliedMove * actualFactor), 2);
    const actualMovePct = round((actualMove / spot) * 100, 2);

    const ratio = impliedMove > 0 ? actualMove / impliedMove : 1;
    const overUnder = ratio > 1.1 ? "over" as const : ratio < 0.9 ? "under" as const : "inline" as const;
    const accuracy = round(Math.max(0, 100 - Math.abs(1 - ratio) * 100), 0);

    entries.push({
      date: date.toISOString().split("T")[0]!,
      impliedMove: Math.abs(impliedMove),
      impliedMovePct: Math.abs(impliedMovePct),
      actualMove,
      actualMovePct,
      overUnder,
      accuracy
    });
  }

  return entries;
}

// ─── What-If Scenario Simulator ─────────────────────────────────────────────

export interface WhatIfResult {
  theoreticalPrice: number;
  pnl: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

function normCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

function normPdf(x: number): number {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

export function computeWhatIf(
  optionType: "CALL" | "PUT",
  currentSpot: number,
  strike: number,
  currentLtp: number,
  iv: number,
  daysToExpiry: number,
  // Scenario adjustments
  spotChange: number,     // absolute change in spot
  daysForward: number,    // days to fast-forward
  ivChange: number,       // absolute change in IV percentage
  lotSize: number
): WhatIfResult {
  const newSpot = currentSpot + spotChange;
  const newDte = Math.max(0.01, daysToExpiry - daysForward);
  const newIv = Math.max(1, iv + ivChange);
  const r = 0.07;
  const t = newDte / 365;
  const sigma = newIv / 100;

  if (t <= 0 || sigma <= 0 || newSpot <= 0) {
    const intrinsic = optionType === "CALL"
      ? Math.max(0, newSpot - strike)
      : Math.max(0, strike - newSpot);
    return {
      theoreticalPrice: round(intrinsic, 2),
      pnl: round((intrinsic - currentLtp) * lotSize, 0),
      delta: optionType === "CALL" ? (newSpot > strike ? 1 : 0) : (newSpot < strike ? -1 : 0),
      gamma: 0, theta: 0, vega: 0
    };
  }

  const d1 = (Math.log(newSpot / strike) + (r + sigma * sigma / 2) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);

  let price: number;
  let delta: number;

  if (optionType === "CALL") {
    price = newSpot * normCdf(d1) - strike * Math.exp(-r * t) * normCdf(d2);
    delta = round(normCdf(d1), 4);
  } else {
    price = strike * Math.exp(-r * t) * normCdf(-d2) - newSpot * normCdf(-d1);
    delta = round(normCdf(d1) - 1, 4);
  }

  const gamma = round(normPdf(d1) / (newSpot * sigma * Math.sqrt(t)), 6);
  const theta = round(
    -(newSpot * normPdf(d1) * sigma) / (2 * Math.sqrt(t)) / 365
    - r * strike * Math.exp(-r * t) * (optionType === "CALL" ? normCdf(d2) : normCdf(-d2)) / 365,
    2
  );
  const vega = round(newSpot * normPdf(d1) * Math.sqrt(t) / 100, 2);

  return {
    theoreticalPrice: round(Math.max(0, price), 2),
    pnl: round((price - currentLtp) * lotSize, 0),
    delta,
    gamma,
    theta,
    vega
  };
}

// ─── IV Percentile ──────────────────────────────────────────────────────────

export interface IvPercentileData {
  currentIv: number;
  percentile: number;
  regime: "very-cheap" | "cheap" | "normal" | "rich" | "very-rich";
  historicalIvs: { date: string; iv: number }[];
  suggestion: string;
}

export function computeIvPercentile(
  rows: OptionChainRow[],
  spot: number,
  symbol: SupportedSymbol
): IvPercentileData {
  if (!rows.length || spot <= 0) {
    return {
      currentIv: 0, percentile: 50, regime: "normal",
      historicalIvs: [], suggestion: "No data available"
    };
  }

  // Get current ATM IV
  const atmRow = rows.reduce((c, r) =>
    Math.abs(r.strike - spot) < Math.abs(c.strike - spot) ? r : c
  );
  const currentIv = round((atmRow.call.iv + atmRow.put.iv) / 2, 2);

  // Generate simulated 30-day historical IV
  const seed = Math.floor(spot) % 500;
  const historicalIvs: { date: string; iv: number }[] = [];
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dayHash = (seed + i * 71 + date.getDate() * 17) % 300;
    const baseIv = symbol === "BANKNIFTY" ? 16 : symbol === "FINNIFTY" ? 14 : 12;
    const historicalIv = round(baseIv + (dayHash - 150) * 0.06, 2);
    historicalIvs.push({ date: date.toISOString().split("T")[0]!, iv: Math.max(5, historicalIv) });
  }

  const sorted = [...historicalIvs.map((h) => h.iv)].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= currentIv).length;
  const percentile = round((rank / sorted.length) * 100, 0);

  let regime: IvPercentileData["regime"];
  let suggestion: string;

  if (percentile <= 15) {
    regime = "very-cheap";
    suggestion = "IV extremely low. Consider buying strategies (straddles, strangles). Premiums are cheap.";
  } else if (percentile <= 35) {
    regime = "cheap";
    suggestion = "IV below average. Favor buying strategies. Good entry for long volatility bets.";
  } else if (percentile <= 65) {
    regime = "normal";
    suggestion = "IV in normal range. Both buying and selling strategies viable. Focus on direction.";
  } else if (percentile <= 85) {
    regime = "rich";
    suggestion = "IV elevated. Consider selling strategies (short strangles, iron condors). Premiums are rich.";
  } else {
    regime = "very-rich";
    suggestion = "IV extremely high. Strong edge in selling premium. Beware of tail risk events.";
  }

  return { currentIv, percentile, regime, historicalIvs, suggestion };
}

// ─── Market Pulse Summary ───────────────────────────────────────────────────

export interface MarketPulse {
  timestamp: string;
  spotLevel: string;
  trend: "bullish" | "bearish" | "sideways";
  keyLevels: { support: number; resistance: number };
  pcrReading: string;
  maxPainNote: string;
  fiiSentiment: string;
  volatilityNote: string;
  topSignal: string;
  summary: string;
}

export function generateMarketPulse(
  rows: OptionChainRow[],
  spot: number,
  symbol: SupportedSymbol,
  pcrOi: number,
  maxPainStrike: number,
  ivPercentile: number
): MarketPulse {
  // Determine support/resistance from OI walls
  const callWall = [...rows].sort((a, b) => b.call.oi - a.call.oi)[0]?.strike ?? spot + 200;
  const putWall = [...rows].sort((a, b) => b.put.oi - a.put.oi)[0]?.strike ?? spot - 200;

  const trend = pcrOi > 1.2 ? "bullish" as const : pcrOi < 0.8 ? "bearish" as const : "sideways" as const;

  const pcrReading = pcrOi > 1.3
    ? `PCR at ${pcrOi.toFixed(2)} - heavily oversold. Contrarian bullish signal.`
    : pcrOi > 1.0
      ? `PCR at ${pcrOi.toFixed(2)} - mildly bullish. Puts dominating OI.`
      : pcrOi > 0.7
        ? `PCR at ${pcrOi.toFixed(2)} - neutral zone. No clear directional bias.`
        : `PCR at ${pcrOi.toFixed(2)} - overbought territory. Contrarian bearish signal.`;

  const painDiff = spot - maxPainStrike;
  const maxPainNote = Math.abs(painDiff) < spot * 0.003
    ? `Spot near Max Pain (${maxPainStrike}). Expect pin action near expiry.`
    : painDiff > 0
      ? `Spot ${painDiff.toFixed(0)}pts above Max Pain (${maxPainStrike}). Gravitational pull downward.`
      : `Spot ${Math.abs(painDiff).toFixed(0)}pts below Max Pain (${maxPainStrike}). Gravitational pull upward.`;

  const volatilityNote = ivPercentile > 75
    ? `IV at ${ivPercentile}th percentile - RICH. Premium selling environment.`
    : ivPercentile > 40
      ? `IV at ${ivPercentile}th percentile - NORMAL. Standard market conditions.`
      : `IV at ${ivPercentile}th percentile - CHEAP. Premium buying opportunity.`;

  const netCallDeltaOi = rows.reduce((s, r) => s + r.call.deltaOi, 0);
  const netPutDeltaOi = rows.reduce((s, r) => s + r.put.deltaOi, 0);

  const topSignal = netPutDeltaOi > netCallDeltaOi * 1.5
    ? "Strong PUT writing detected. Writers confident spot stays above current levels. BULLISH."
    : netCallDeltaOi > netPutDeltaOi * 1.5
      ? "Strong CALL writing detected. Writers confident spot stays below current levels. BEARISH."
      : "Balanced OI buildup. No strong directional conviction from writers.";

  const summary = `${symbol} at ${spot.toLocaleString("en-IN")}. `
    + `Range: ${putWall.toLocaleString("en-IN")} - ${callWall.toLocaleString("en-IN")}. `
    + `${trend === "bullish" ? "Bullish" : trend === "bearish" ? "Bearish" : "Sideways"} bias. `
    + `${ivPercentile > 70 ? "High IV - consider selling." : ivPercentile < 30 ? "Low IV - consider buying." : "IV normal."}`;

  return {
    timestamp: new Date().toISOString(),
    spotLevel: `${symbol} ${spot.toLocaleString("en-IN")}`,
    trend,
    keyLevels: { support: putWall, resistance: callWall },
    pcrReading,
    maxPainNote,
    fiiSentiment: "FII data updated EOD. Check FII/DII panel for latest positioning.",
    volatilityNote,
    topSignal,
    summary
  };
}
