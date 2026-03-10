import { UNDERLYINGS } from "@/lib/constants";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";
import { round } from "@/lib/utils";

// ─── Unusual Options Activity (UOA) Scanner ─────────────────────────────────

export type UoaSentiment = "bullish" | "bearish" | "neutral";

export interface UoaEntry {
  id: string;
  strike: number;
  optionType: "CALL" | "PUT";
  volume: number;
  oi: number;
  deltaOi: number;
  volumeOiRatio: number;
  ltp: number;
  iv: number;
  premiumValue: number;
  sentiment: UoaSentiment;
  intensity: "high" | "medium" | "low";
  timestamp: string;
}

export function scanUnusualActivity(
  rows: OptionChainRow[],
  symbol: SupportedSymbol
): UoaEntry[] {
  const lotSize = UNDERLYINGS[symbol]?.lotSize ?? 50;
  const entries: UoaEntry[] = [];

  for (const row of rows) {
    for (const leg of [row.call, row.put] as const) {
      if (leg.oi <= 0 || leg.volume <= 0) continue;

      const volumeOiRatio = leg.volume / leg.oi;
      const premiumValue = round(leg.ltp * leg.volume * lotSize, 0);

      // Flag if volume/OI ratio > 0.3 (30% turnover) or deltaOI is large
      const isHighVolume = volumeOiRatio > 0.5;
      const isMediumVolume = volumeOiRatio > 0.3;
      const isLargeOiChange = Math.abs(leg.deltaOi) > leg.oi * 0.1;

      if (!isHighVolume && !isMediumVolume && !isLargeOiChange) continue;

      let sentiment: UoaSentiment = "neutral";
      if (leg.optionType === "CALL") {
        sentiment = leg.deltaOi > 0 ? "bullish" : leg.deltaOi < 0 ? "bearish" : "neutral";
      } else {
        sentiment = leg.deltaOi > 0 ? "bearish" : leg.deltaOi < 0 ? "bullish" : "neutral";
      }

      const intensity = isHighVolume ? "high" : isMediumVolume ? "medium" : "low";

      entries.push({
        id: `${leg.securityId}-${Date.now()}`,
        strike: row.strike,
        optionType: leg.optionType,
        volume: leg.volume,
        oi: leg.oi,
        deltaOi: leg.deltaOi,
        volumeOiRatio: round(volumeOiRatio, 3),
        ltp: leg.ltp,
        iv: leg.iv,
        premiumValue,
        sentiment,
        intensity,
        timestamp: new Date().toISOString()
      });
    }
  }

  return entries
    .sort((a, b) => b.volumeOiRatio - a.volumeOiRatio)
    .slice(0, 20);
}

// ─── Multi-Strike OI Change Tracker ─────────────────────────────────────────

export interface MultiStrikePoint {
  strike: number;
  callOi: number;
  putOi: number;
  callDeltaOi: number;
  putDeltaOi: number;
  callVolume: number;
  putVolume: number;
}

export function getMultiStrikeData(
  rows: OptionChainRow[],
  spot: number,
  numStrikes: number = 10
): MultiStrikePoint[] {
  if (!rows.length || spot <= 0) return [];

  // Find ATM index
  const atmIdx = rows.reduce((bestIdx, row, idx) =>
    Math.abs(row.strike - spot) < Math.abs(rows[bestIdx]!.strike - spot) ? idx : bestIdx,
    0
  );

  const half = Math.floor(numStrikes / 2);
  const start = Math.max(0, atmIdx - half);
  const end = Math.min(rows.length, start + numStrikes);

  return rows.slice(start, end).map((row) => ({
    strike: row.strike,
    callOi: row.call.oi,
    putOi: row.put.oi,
    callDeltaOi: row.call.deltaOi,
    putDeltaOi: row.put.deltaOi,
    callVolume: row.call.volume,
    putVolume: row.put.volume
  }));
}

// ─── P&L Heatmap (Spot x Time) ─────────────────────────────────────────────

export interface PnlHeatmapCell {
  spot: number;
  dte: number;
  pnl: number;
}

export interface PnlHeatmapData {
  cells: PnlHeatmapCell[];
  spotRange: number[];
  dteRange: number[];
  maxProfit: number;
  maxLoss: number;
}

function bsCallPrice(
  spot: number,
  strike: number,
  dte: number,
  iv: number,
  r: number = 0.07
): number {
  if (dte <= 0) return Math.max(0, spot - strike);
  const t = dte / 365;
  const sigma = iv / 100;
  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);
  return spot * normCdf(d1) - strike * Math.exp(-r * t) * normCdf(d2);
}

function bsPutPrice(
  spot: number,
  strike: number,
  dte: number,
  iv: number,
  r: number = 0.07
): number {
  if (dte <= 0) return Math.max(0, strike - spot);
  const t = dte / 365;
  const sigma = iv / 100;
  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);
  return strike * Math.exp(-r * t) * normCdf(-d2) - spot * normCdf(-d1);
}

function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

interface HeatmapLeg {
  side: "BUY" | "SELL";
  optionType: "CALL" | "PUT";
  strike: number;
  premium: number;
  quantity: number;
  iv: number;
  lotSize: number;
}

export function computePnlHeatmap(
  legs: HeatmapLeg[],
  spot: number,
  maxDte: number = 7
): PnlHeatmapData {
  if (!legs.length || spot <= 0) {
    return { cells: [], spotRange: [], dteRange: [], maxProfit: 0, maxLoss: 0 };
  }

  const range = spot * 0.08; // ±8% range
  const spotSteps = 25;
  const dteSteps = Math.min(maxDte, 7);

  const spotRange: number[] = [];
  for (let i = 0; i <= spotSteps; i++) {
    spotRange.push(round(spot - range + (2 * range * i) / spotSteps, 0));
  }

  const dteRange: number[] = [];
  for (let d = dteSteps; d >= 0; d--) {
    dteRange.push(d);
  }

  const cells: PnlHeatmapCell[] = [];
  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (const dte of dteRange) {
    for (const s of spotRange) {
      let totalPnl = 0;

      for (const leg of legs) {
        const priceFn = leg.optionType === "CALL" ? bsCallPrice : bsPutPrice;
        const currentPrice = priceFn(s, leg.strike, dte, leg.iv);
        const sideMultiplier = leg.side === "BUY" ? 1 : -1;
        const legPnl = (currentPrice - leg.premium) * sideMultiplier * leg.quantity * leg.lotSize;
        totalPnl += legPnl;
      }

      totalPnl = round(totalPnl, 0);
      cells.push({ spot: s, dte, pnl: totalPnl });
      if (totalPnl > maxProfit) maxProfit = totalPnl;
      if (totalPnl < maxLoss) maxLoss = totalPnl;
    }
  }

  return { cells, spotRange, dteRange, maxProfit, maxLoss };
}

// ─── FII/DII Simulated Data ────────────────────────────────────────────────

export interface FiiDiiData {
  date: string;
  fiiNetFutures: number;
  fiiLongCallOi: number;
  fiiShortCallOi: number;
  fiiLongPutOi: number;
  fiiShortPutOi: number;
  fiiNetOptionsOi: number;
  diiNetFutures: number;
  clientNetFutures: number;
  proNetFutures: number;
  fiiSentiment: "bullish" | "bearish" | "neutral";
  fiiIndexFuturesChange: number;
}

export function generateFiiDiiData(spot: number): FiiDiiData[] {
  // Generate simulated 5-day FII/DII data based on spot price seed
  const seed = Math.floor(spot) % 1000;
  const data: FiiDiiData[] = [];
  const today = new Date();

  for (let i = 4; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dayFactor = ((seed + i * 137) % 200 - 100) / 100;
    const fiiNetFutures = Math.round(dayFactor * 15000 + (Math.random() - 0.5) * 8000);
    const fiiLongCallOi = Math.round(180000 + dayFactor * 40000);
    const fiiShortCallOi = Math.round(160000 - dayFactor * 30000);
    const fiiLongPutOi = Math.round(140000 - dayFactor * 35000);
    const fiiShortPutOi = Math.round(170000 + dayFactor * 25000);

    data.push({
      date: date.toISOString().split("T")[0]!,
      fiiNetFutures,
      fiiLongCallOi,
      fiiShortCallOi,
      fiiLongPutOi,
      fiiShortPutOi,
      fiiNetOptionsOi: (fiiLongCallOi - fiiShortCallOi) + (fiiLongPutOi - fiiShortPutOi),
      diiNetFutures: Math.round(-fiiNetFutures * 0.6 + (Math.random() - 0.5) * 5000),
      clientNetFutures: Math.round(-fiiNetFutures * 0.3 + (Math.random() - 0.5) * 3000),
      proNetFutures: Math.round(-fiiNetFutures * 0.1 + (Math.random() - 0.5) * 2000),
      fiiSentiment: fiiNetFutures > 3000 ? "bullish" : fiiNetFutures < -3000 ? "bearish" : "neutral",
      fiiIndexFuturesChange: Math.round(fiiNetFutures * 0.3 + (Math.random() - 0.5) * 2000)
    });
  }

  return data;
}
