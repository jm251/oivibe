import { addDays, format, nextThursday } from "date-fns";

import { DEFAULT_SYMBOL, UNDERLYINGS } from "@/lib/constants";
import { computeAggregates } from "@/lib/market/analytics";
import { OptionChainSnapshot, OptionChainRow, SupportedSymbol, TickDelta } from "@/lib/types";
import { hashString, round } from "@/lib/utils";

interface MockState {
  snapshot: OptionChainSnapshot;
  random: () => number;
}

const baseSpots: Record<SupportedSymbol, number> = {
  NIFTY: 22_550,
  BANKNIFTY: 49_400,
  FINNIFTY: 24_350
};

function mulberry32(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function optionPremium(spot: number, strike: number, side: "CALL" | "PUT", iv: number) {
  const intrinsic = side === "CALL" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const time = Math.max(4, (Math.abs(spot - strike) * 0.03 + iv * 2.2) * 0.7);
  return round(intrinsic + time, 2);
}

function createRows(symbol: SupportedSymbol, expiry: string, spot: number, random: () => number) {
  const underlying = UNDERLYINGS[symbol];
  const strikesEachSide = 14;
  const anchor = Math.round(spot / underlying.strikeStep) * underlying.strikeStep;

  const rows: OptionChainRow[] = [];
  for (let i = -strikesEachSide; i <= strikesEachSide; i += 1) {
    const strike = anchor + i * underlying.strikeStep;
    const iv = round(9 + random() * 22, 2);

    const callOi = Math.round(10_000 + random() * 120_000);
    const putOi = Math.round(10_000 + random() * 120_000);

    rows.push({
      strike,
      call: {
        securityId: `MOCK-${symbol}-${expiry}-${strike}-CE`,
        strike,
        optionType: "CALL",
        ltp: optionPremium(spot, strike, "CALL", iv),
        oi: callOi,
        previousOi: callOi,
        deltaOi: 0,
        volume: Math.round(500 + random() * 9000),
        iv,
        bid: optionPremium(spot, strike, "CALL", iv) - 0.8,
        ask: optionPremium(spot, strike, "CALL", iv) + 0.8,
        greeks: {
          delta: round(Math.max(0.05, Math.min(0.95, 0.5 + (spot - strike) / 1200)), 3),
          gamma: round(0.01 + random() * 0.08, 4),
          theta: round(-6 - random() * 24, 2),
          vega: round(3 + random() * 16, 2)
        }
      },
      put: {
        securityId: `MOCK-${symbol}-${expiry}-${strike}-PE`,
        strike,
        optionType: "PUT",
        ltp: optionPremium(spot, strike, "PUT", iv),
        oi: putOi,
        previousOi: putOi,
        deltaOi: 0,
        volume: Math.round(500 + random() * 9000),
        iv,
        bid: optionPremium(spot, strike, "PUT", iv) - 0.8,
        ask: optionPremium(spot, strike, "PUT", iv) + 0.8,
        greeks: {
          delta: round(-Math.max(0.05, Math.min(0.95, 0.5 + (strike - spot) / 1200)), 3),
          gamma: round(0.01 + random() * 0.08, 4),
          theta: round(-6 - random() * 24, 2),
          vega: round(3 + random() * 16, 2)
        }
      }
    });
  }

  return rows;
}

function createSnapshot(symbol: SupportedSymbol, expiry: string): OptionChainSnapshot {
  const seed = hashString(`${symbol}-${expiry}`);
  const random = mulberry32(seed);
  const spot = baseSpots[symbol] + Math.round((random() - 0.5) * 160);
  const rows = createRows(symbol, expiry, spot, random);

  return {
    mode: "mock",
    symbol,
    expiry,
    spot,
    rows,
    aggregates: computeAggregates(rows),
    updatedAt: new Date().toISOString()
  };
}

export function getMockExpiries(_symbol: SupportedSymbol = DEFAULT_SYMBOL) {
  const today = new Date();
  const first = nextThursday(today);
  return [0, 7, 14, 21].map((days) => format(addDays(first, days), "yyyy-MM-dd"));
}

export class MockMarketEngine {
  private states = new Map<string, MockState>();

  private key(symbol: SupportedSymbol, expiry: string) {
    return `${symbol}:${expiry}`;
  }

  getSnapshot(symbol: SupportedSymbol, expiry: string): OptionChainSnapshot {
    const key = this.key(symbol, expiry);
    const existing = this.states.get(key);
    if (existing) {
      return existing.snapshot;
    }

    const snapshot = createSnapshot(symbol, expiry);
    const state: MockState = {
      snapshot,
      random: mulberry32(hashString(`${key}:ticks`))
    };
    this.states.set(key, state);
    return snapshot;
  }

  tick(symbol: SupportedSymbol, expiry: string): {
    snapshot: OptionChainSnapshot;
    updates: TickDelta[];
  } {
    const key = this.key(symbol, expiry);
    const state = this.states.get(key) ?? {
      snapshot: createSnapshot(symbol, expiry),
      random: mulberry32(hashString(`${key}:ticks`))
    };

    this.states.set(key, state);

    const random = state.random;
    const updates: TickDelta[] = [];

    const spotDrift = (random() - 0.5) * (state.snapshot.symbol === "BANKNIFTY" ? 55 : 28);
    const nextSpot = round(state.snapshot.spot + spotDrift, 2);

    state.snapshot.rows = state.snapshot.rows.map((row) => {
      const mutateLeg = (leg: OptionChainRow["call"]) => {
        if (random() < 0.35) {
          const oiChange = Math.round((random() - 0.45) * 1_600);
          const nextOi = Math.max(0, leg.oi + oiChange);
          const nextVolume = Math.max(0, leg.volume + Math.round(random() * 420));
          const intrinsic =
            leg.optionType === "CALL"
              ? Math.max(0, nextSpot - row.strike)
              : Math.max(0, row.strike - nextSpot);
          const timeValue = Math.max(3, leg.iv * 0.55 + Math.abs(nextSpot - row.strike) * 0.01);
          const nextLtp = round(intrinsic + timeValue + (random() - 0.5) * 2.2, 2);
          const deltaOi = nextOi - leg.oi;

          updates.push({
            securityId: leg.securityId,
            ltp: nextLtp,
            volume: nextVolume,
            oi: nextOi,
            deltaOi
          });

          return {
            ...leg,
            ltp: nextLtp,
            previousOi: leg.oi,
            oi: nextOi,
            deltaOi,
            volume: nextVolume,
            bid: round(Math.max(0.05, nextLtp - 0.8), 2),
            ask: round(nextLtp + 0.8, 2),
            iv: round(Math.max(7, leg.iv + (random() - 0.5) * 0.6), 2)
          };
        }

        return {
          ...leg,
          deltaOi: 0
        };
      };

      return {
        ...row,
        call: mutateLeg(row.call),
        put: mutateLeg(row.put)
      };
    });

    state.snapshot.spot = nextSpot;
    state.snapshot.aggregates = computeAggregates(state.snapshot.rows);
    state.snapshot.updatedAt = new Date().toISOString();

    return {
      snapshot: state.snapshot,
      updates
    };
  }
}

export const mockMarketEngine = new MockMarketEngine();