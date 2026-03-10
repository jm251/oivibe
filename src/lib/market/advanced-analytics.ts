import { UNDERLYINGS } from "@/lib/constants";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";
import { round } from "@/lib/utils";

// ─── OI Buildup Classification ──────────────────────────────────────────────

export type BuildupType =
  | "long-buildup"
  | "short-buildup"
  | "long-unwinding"
  | "short-covering"
  | "neutral";

export interface BuildupClassification {
  strike: number;
  callBuildup: BuildupType;
  putBuildup: BuildupType;
  callDeltaOi: number;
  putDeltaOi: number;
  callLtpChange: number;
  putLtpChange: number;
}

function classifyBuildup(deltaOi: number, ltpChange: number): BuildupType {
  const oiThreshold = 50;
  const priceThreshold = 0.1;

  if (Math.abs(deltaOi) < oiThreshold) return "neutral";

  if (deltaOi > 0 && ltpChange > priceThreshold) return "long-buildup";
  if (deltaOi > 0 && ltpChange < -priceThreshold) return "short-buildup";
  if (deltaOi < 0 && ltpChange < -priceThreshold) return "long-unwinding";
  if (deltaOi < 0 && ltpChange > priceThreshold) return "short-covering";
  return "neutral";
}

export function classifyOiBuildups(
  rows: OptionChainRow[],
  previousRows?: OptionChainRow[]
): BuildupClassification[] {
  const prevMap = new Map<number, OptionChainRow>();
  if (previousRows) {
    for (const row of previousRows) {
      prevMap.set(row.strike, row);
    }
  }

  return rows.map((row) => {
    const prev = prevMap.get(row.strike);
    const callLtpChange = prev ? row.call.ltp - prev.call.ltp : 0;
    const putLtpChange = prev ? row.put.ltp - prev.put.ltp : 0;

    return {
      strike: row.strike,
      callBuildup: classifyBuildup(row.call.deltaOi, callLtpChange),
      putBuildup: classifyBuildup(row.put.deltaOi, putLtpChange),
      callDeltaOi: row.call.deltaOi,
      putDeltaOi: row.put.deltaOi,
      callLtpChange: round(callLtpChange, 2),
      putLtpChange: round(putLtpChange, 2)
    };
  });
}

// ─── Max Pain Calculator ────────────────────────────────────────────────────

export interface MaxPainResult {
  maxPainStrike: number;
  painByStrike: { strike: number; totalPain: number; callPain: number; putPain: number }[];
  pinZoneLow: number;
  pinZoneHigh: number;
}

export function computeMaxPain(rows: OptionChainRow[], spot: number): MaxPainResult {
  const painByStrike = rows.map((targetRow) => {
    const targetStrike = targetRow.strike;
    let callPain = 0;
    let putPain = 0;

    for (const row of rows) {
      // Call buyers lose money when price settles below their strike
      if (targetStrike > row.strike) {
        callPain += (targetStrike - row.strike) * row.call.oi;
      }
      // Put buyers lose money when price settles above their strike
      if (targetStrike < row.strike) {
        putPain += (row.strike - targetStrike) * row.put.oi;
      }
    }

    return {
      strike: targetStrike,
      totalPain: callPain + putPain,
      callPain,
      putPain
    };
  });

  const minPain = painByStrike.reduce(
    (min, entry) => (entry.totalPain < min.totalPain ? entry : min),
    painByStrike[0] ?? { strike: spot, totalPain: Infinity, callPain: 0, putPain: 0 }
  );

  const pinZonePercent = 0.005; // 0.5%
  return {
    maxPainStrike: minPain.strike,
    painByStrike,
    pinZoneLow: round(minPain.strike * (1 - pinZonePercent), 2),
    pinZoneHigh: round(minPain.strike * (1 + pinZonePercent), 2)
  };
}

// ─── Straddle Premium Tracker (Expected Move) ───────────────────────────────

export interface StraddleData {
  atmStrike: number;
  callPremium: number;
  putPremium: number;
  straddlePremium: number;
  expectedMovePercent: number;
  expectedMovePoints: number;
  upperBreakeven: number;
  lowerBreakeven: number;
  stranglePremium: number;
  strangleCallStrike: number;
  stranglePutStrike: number;
}

export function computeStraddleData(
  rows: OptionChainRow[],
  spot: number,
  symbol: SupportedSymbol
): StraddleData {
  if (!rows.length || spot <= 0) {
    return {
      atmStrike: 0,
      callPremium: 0,
      putPremium: 0,
      straddlePremium: 0,
      expectedMovePercent: 0,
      expectedMovePoints: 0,
      upperBreakeven: 0,
      lowerBreakeven: 0,
      stranglePremium: 0,
      strangleCallStrike: 0,
      stranglePutStrike: 0
    };
  }

  const strikeStep = UNDERLYINGS[symbol]?.strikeStep ?? 50;

  // Find ATM strike (closest to spot)
  const atmRow = rows.reduce((closest, row) =>
    Math.abs(row.strike - spot) < Math.abs(closest.strike - spot) ? row : closest
  );

  const atmStrike = atmRow.strike;
  const callPremium = atmRow.call.ltp;
  const putPremium = atmRow.put.ltp;
  const straddlePremium = round(callPremium + putPremium, 2);
  const expectedMovePoints = round(straddlePremium, 2);
  const expectedMovePercent = round((straddlePremium / spot) * 100, 2);

  // Strangle: one strike OTM each side
  const strangleCallStrike = atmStrike + strikeStep;
  const stranglePutStrike = atmStrike - strikeStep;
  const strangleCallRow = rows.find((r) => r.strike === strangleCallStrike);
  const stranglePutRow = rows.find((r) => r.strike === stranglePutStrike);
  const stranglePremium = round(
    (strangleCallRow?.call.ltp ?? 0) + (stranglePutRow?.put.ltp ?? 0),
    2
  );

  return {
    atmStrike,
    callPremium: round(callPremium, 2),
    putPremium: round(putPremium, 2),
    straddlePremium,
    expectedMovePercent,
    expectedMovePoints,
    upperBreakeven: round(atmStrike + straddlePremium, 2),
    lowerBreakeven: round(atmStrike - straddlePremium, 2),
    stranglePremium,
    strangleCallStrike,
    stranglePutStrike
  };
}

// ─── Gamma Exposure (GEX) Profile ───────────────────────────────────────────

export interface GexEntry {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
}

export interface GexProfile {
  entries: GexEntry[];
  gammaFlipStrike: number | null;
  totalNetGex: number;
  isPositiveGamma: boolean;
}

export function computeGexProfile(
  rows: OptionChainRow[],
  spot: number,
  symbol: SupportedSymbol
): GexProfile {
  const lotSize = UNDERLYINGS[symbol]?.lotSize ?? 50;

  const entries: GexEntry[] = rows.map((row) => {
    // GEX = gamma * OI * spot * 0.01 * contractMultiplier
    // Call gamma is positive (dealers long gamma from selling calls)
    // Put gamma is negative (dealers short gamma from selling puts)
    const callGex = row.call.greeks.gamma * row.call.oi * spot * 0.01 * lotSize;
    const putGex = -row.put.greeks.gamma * row.put.oi * spot * 0.01 * lotSize;

    return {
      strike: row.strike,
      callGex: round(callGex, 0),
      putGex: round(putGex, 0),
      netGex: round(callGex + putGex, 0)
    };
  });

  // Find gamma flip point (where cumulative GEX changes sign)
  let gammaFlipStrike: number | null = null;
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1]!;
    const curr = entries[i]!;
    if (
      (prev.netGex >= 0 && curr.netGex < 0) ||
      (prev.netGex < 0 && curr.netGex >= 0)
    ) {
      gammaFlipStrike = curr.strike;
      break;
    }
  }

  const totalNetGex = entries.reduce((sum, e) => sum + e.netGex, 0);

  return {
    entries,
    gammaFlipStrike,
    totalNetGex: round(totalNetGex, 0),
    isPositiveGamma: totalNetGex >= 0
  };
}

// ─── IV Skew Curve ──────────────────────────────────────────────────────────

export interface IvSkewPoint {
  strike: number;
  callIv: number;
  putIv: number;
  avgIv: number;
  distanceFromAtm: number;
}

export interface IvSkewData {
  points: IvSkewPoint[];
  atmIv: number;
  atmStrike: number;
  skewDirection: "left" | "right" | "flat";
  ivRange: { min: number; max: number };
}

export function computeIvSkew(rows: OptionChainRow[], spot: number): IvSkewData {
  if (!rows.length || spot <= 0) {
    return {
      points: [],
      atmIv: 0,
      atmStrike: 0,
      skewDirection: "flat",
      ivRange: { min: 0, max: 0 }
    };
  }

  const atmRow = rows.reduce((closest, row) =>
    Math.abs(row.strike - spot) < Math.abs(closest.strike - spot) ? row : closest
  );

  const points: IvSkewPoint[] = rows
    .filter((row) => row.call.iv > 0 || row.put.iv > 0)
    .map((row) => ({
      strike: row.strike,
      callIv: round(row.call.iv, 2),
      putIv: round(row.put.iv, 2),
      avgIv: round((row.call.iv + row.put.iv) / 2, 2),
      distanceFromAtm: row.strike - atmRow.strike
    }));

  const ivValues = points.map((p) => p.avgIv).filter((v) => v > 0);
  const atmIv = round((atmRow.call.iv + atmRow.put.iv) / 2, 2);

  // Determine skew direction
  const otmPutIvs = points.filter((p) => p.strike < atmRow.strike).map((p) => p.putIv);
  const otmCallIvs = points.filter((p) => p.strike > atmRow.strike).map((p) => p.callIv);
  const avgOtmPutIv = otmPutIvs.length ? otmPutIvs.reduce((a, b) => a + b, 0) / otmPutIvs.length : 0;
  const avgOtmCallIv = otmCallIvs.length ? otmCallIvs.reduce((a, b) => a + b, 0) / otmCallIvs.length : 0;

  let skewDirection: "left" | "right" | "flat" = "flat";
  if (avgOtmPutIv > avgOtmCallIv * 1.05) skewDirection = "left";
  else if (avgOtmCallIv > avgOtmPutIv * 1.05) skewDirection = "right";

  return {
    points,
    atmIv,
    atmStrike: atmRow.strike,
    skewDirection,
    ivRange: {
      min: ivValues.length ? Math.min(...ivValues) : 0,
      max: ivValues.length ? Math.max(...ivValues) : 0
    }
  };
}
