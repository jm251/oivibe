import { DEFAULT_SYMBOL, UNDERLYINGS } from "@/lib/constants";
import { computeAggregates } from "@/lib/market/analytics";
import { getMockExpiries, mockMarketEngine } from "@/lib/mock/simulator";
import { resolveRuntimeCredentials } from "@/lib/session/runtime";
import {
  fetchUpstoxExpiries,
  fetchUpstoxOptionChainSnapshot
} from "@/lib/upstox/rest";
import { OptionChainSnapshot, SupportedSymbol } from "@/lib/types";

const liveExpiryCache = new Map<SupportedSymbol, string[]>();
const liveSnapshotCache = new Map<string, OptionChainSnapshot>();

function snapshotCacheKey(symbol: SupportedSymbol, expiry: string) {
  return `${symbol}:${expiry}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown live data error";
}

function cacheSnapshot(snapshot: OptionChainSnapshot) {
  liveSnapshotCache.set(snapshotCacheKey(snapshot.symbol, snapshot.expiry), {
    ...snapshot,
    degraded: false,
    message: undefined
  });
}

export function getCachedLiveSnapshot(symbol: SupportedSymbol, expiry: string) {
  return liveSnapshotCache.get(snapshotCacheKey(symbol, expiry)) ?? null;
}

export function resetMarketServiceCaches() {
  liveExpiryCache.clear();
  liveSnapshotCache.clear();
}

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
): Promise<{
  mode: "live" | "mock";
  expiries: string[];
  degraded?: boolean;
  message?: string;
}> {
  const credentials = await resolveRuntimeCredentials();

  if (credentials.credentials) {
    try {
      const expiries = await fetchUpstoxExpiries(credentials.credentials, symbol);

      if (expiries.length > 0) {
        liveExpiryCache.set(symbol, expiries);
        return { mode: "live", expiries };
      }
    } catch (error) {
      const cachedExpiries = liveExpiryCache.get(symbol);

      if (cachedExpiries?.length) {
        return {
          mode: "live",
          expiries: cachedExpiries,
          degraded: true,
          message: "Upstox expiry refresh failed. Using cached expiries."
        };
      }

      return {
        mode: "live",
        expiries: getMockExpiries(symbol),
        degraded: true,
        message: `Upstox expiry refresh failed: ${getErrorMessage(error)}`
      };
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
        const nextSnapshot: OptionChainSnapshot = {
          mode: "live",
          symbol,
          expiry: snapshot.expiry,
          spot: snapshot.spot,
          rows: snapshot.rows,
          aggregates: computeAggregates(snapshot.rows),
          updatedAt: new Date().toISOString()
        };

        cacheSnapshot(nextSnapshot);
        return nextSnapshot;
      }
    } catch (error) {
      const requestedExpiry = expiry ?? getMockExpiries(symbol)[0];
      const cachedSnapshot = requestedExpiry
        ? getCachedLiveSnapshot(symbol, requestedExpiry)
        : null;

      if (cachedSnapshot) {
        return {
          ...cachedSnapshot,
          mode: "live",
          degraded: true,
          message: "Upstox refresh failed. Showing last successful live snapshot."
        };
      }

      throw new Error(`Upstox live snapshot failed: ${getErrorMessage(error)}`);
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
