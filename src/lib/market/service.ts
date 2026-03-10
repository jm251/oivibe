import { DEFAULT_SYMBOL, UNDERLYINGS } from "@/lib/constants";
import { computeAggregates } from "@/lib/market/analytics";
import { getMockExpiries, mockMarketEngine } from "@/lib/mock/simulator";
import { resolveRuntimeCredentials } from "@/lib/session/runtime";
import {
  fetchUpstoxExpiries,
  fetchUpstoxOptionChainSnapshot
} from "@/lib/upstox/rest";
import { OptionChainSnapshot, SupportedSymbol } from "@/lib/types";

export function listUnderlyings() {
  return Object.values(UNDERLYINGS);
}

export function sanitizeSymbol(symbol: string | null | undefined): SupportedSymbol {
  if (!symbol) return DEFAULT_SYMBOL;
  const upper = symbol.toUpperCase();
  if (upper in UNDERLYINGS) {
    return upper as SupportedSymbol;
  }
  return DEFAULT_SYMBOL;
}

export async function resolveExpiries(
  symbol: SupportedSymbol
): Promise<{ mode: "live" | "mock"; expiries: string[] }> {
  const credentials = await resolveRuntimeCredentials();

  if (credentials.credentials) {
    try {
      const expiries = await fetchUpstoxExpiries(credentials.credentials, symbol);

      if (expiries.length > 0) {
        return { mode: "live", expiries };
      }
    } catch {
      // fallback below
    }
  }

  return {
    mode: "mock",
    expiries: getMockExpiries(symbol)
  };
}

export async function resolveOptionChainSnapshot(
  symbol: SupportedSymbol,
  expiry?: string
): Promise<OptionChainSnapshot> {
  const credentials = await resolveRuntimeCredentials();
  if (credentials.credentials) {
    try {
      const snapshot = await fetchUpstoxOptionChainSnapshot(
        credentials.credentials,
        symbol,
        expiry
      );

      if (snapshot.rows.length > 0) {
        return {
          mode: "live",
          symbol,
          expiry: snapshot.expiry,
          spot: snapshot.spot,
          rows: snapshot.rows,
          aggregates: computeAggregates(snapshot.rows),
          updatedAt: new Date().toISOString()
        };
      }
    } catch {
      // fallback to mock
    }
  }

  const mockExpiry =
    expiry ??
    getMockExpiries(symbol)[0] ??
    getMockExpiries(DEFAULT_SYMBOL)[0];
  const snapshot = mockMarketEngine.getSnapshot(symbol, mockExpiry);
  return {
    ...snapshot,
    mode: "mock"
  };
}
