import { UNDERLYINGS } from "@/lib/constants";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";
import { round, safeNumber } from "@/lib/utils";

import {
  UpstoxChainEntry,
  UpstoxChainSnapshot,
  UpstoxCredentials,
  UpstoxOptionContract
} from "@/lib/upstox/types";

const API_BASE_URL = "https://api.upstox.com";
const CONTRACT_CACHE_MS = 5 * 60 * 1000;

const contractCache = new Map<
  string,
  { ts: number; contracts: UpstoxOptionContract[] }
>();

interface UpstoxEnvelope<T> {
  status?: string;
  data?: T;
  errors?: Array<{ errorCode?: string; message?: string }>;
}

function sanitize(value: string) {
  return value.trim().replace(/^['\"]|['\"]$/g, "");
}

async function fetchUpstox<T>(
  credentials: UpstoxCredentials,
  path: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${sanitize(credentials.accessToken)}`
    },
    cache: "no-store"
  });

  const text = await response.text();
  let payload: UpstoxEnvelope<T>;

  try {
    payload = JSON.parse(text) as UpstoxEnvelope<T>;
  } catch {
    throw new Error(`Upstox API ${path} returned non-JSON payload`);
  }

  if (!response.ok || payload.status !== "success") {
    const message =
      payload.errors?.[0]?.message ??
      payload.errors?.[0]?.errorCode ??
      `Upstox API ${path} failed`;
    throw new Error(message);
  }

  return payload.data as T;
}

async function fetchOptionContracts(
  credentials: UpstoxCredentials,
  symbol: SupportedSymbol
) {
  const cacheKey = `${symbol}:${sanitize(credentials.accessToken).slice(-16)}`;
  const cached = contractCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < CONTRACT_CACHE_MS) {
    return cached.contracts;
  }

  const underlying = UNDERLYINGS[symbol];
  const contracts = await fetchUpstox<UpstoxOptionContract[]>(
    credentials,
    `/v2/option/contract?instrument_key=${encodeURIComponent(
      underlying.upstoxInstrumentKey
    )}`
  );

  contractCache.set(cacheKey, { ts: now, contracts });
  return contracts;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function toLeg(
  strike: number,
  optionType: "CALL" | "PUT",
  leg: UpstoxChainEntry["call_options"] | UpstoxChainEntry["put_options"]
) {
  const marketData = leg?.market_data;
  const greeks = leg?.option_greeks;
  const oi = safeNumber(marketData?.oi, 0);
  const previousOi = safeNumber(marketData?.prev_oi, oi);

  return {
    securityId: String(leg?.instrument_key ?? `${strike}-${optionType}`),
    strike,
    optionType,
    ltp: safeNumber(marketData?.ltp, 0),
    oi,
    previousOi,
    deltaOi: oi - previousOi,
    volume: safeNumber(marketData?.volume, 0),
    iv: safeNumber(greeks?.iv, 0),
    bid: safeNumber(marketData?.bid_price, 0),
    ask: safeNumber(marketData?.ask_price, 0),
    greeks: {
      delta: safeNumber(greeks?.delta, 0),
      gamma: safeNumber(greeks?.gamma, 0),
      theta: safeNumber(greeks?.theta, 0),
      vega: safeNumber(greeks?.vega, 0)
    }
  };
}

function buildRows(entries: UpstoxChainEntry[]): OptionChainRow[] {
  return entries
    .map((entry) => ({
      strike: safeNumber(entry.strike_price, 0),
      call: toLeg(safeNumber(entry.strike_price, 0), "CALL", entry.call_options),
      put: toLeg(safeNumber(entry.strike_price, 0), "PUT", entry.put_options)
    }))
    .filter((row) => row.strike > 0)
    .sort((a, b) => a.strike - b.strike);
}

export async function validateUpstoxAccessToken(credentials: UpstoxCredentials) {
  await fetchOptionContracts(credentials, "NIFTY");
  return true;
}

export async function fetchUpstoxExpiries(
  credentials: UpstoxCredentials,
  symbol: SupportedSymbol
) {
  const contracts = await fetchOptionContracts(credentials, symbol);
  return uniqueSorted(contracts.map((contract) => contract.expiry));
}

export async function fetchUpstoxOptionChainSnapshot(
  credentials: UpstoxCredentials,
  symbol: SupportedSymbol,
  preferredExpiry?: string
): Promise<UpstoxChainSnapshot> {
  const underlying = UNDERLYINGS[symbol];
  const expiries = await fetchUpstoxExpiries(credentials, symbol);
  const expiry = preferredExpiry && expiries.includes(preferredExpiry)
    ? preferredExpiry
    : expiries[0];

  if (!expiry) {
    throw new Error(`No expiries available for ${symbol}`);
  }

  const rows = await fetchUpstox<UpstoxChainEntry[]>(
    credentials,
    `/v2/option/chain?instrument_key=${encodeURIComponent(
      underlying.upstoxInstrumentKey
    )}&expiry_date=${encodeURIComponent(expiry)}`
  );

  if (!rows.length) {
    throw new Error(`No option chain rows returned for ${symbol} ${expiry}`);
  }

  const optionRows = buildRows(rows);
  const subscriptionKeys = rows.flatMap((row) => [
    row.call_options?.instrument_key ?? "",
    row.put_options?.instrument_key ?? ""
  ]);

  return {
    spot: round(safeNumber(rows[0]?.underlying_spot_price, 0), 2),
    expiry,
    rows: optionRows,
    subscriptionKeys: Array.from(
      new Set([underlying.upstoxInstrumentKey, ...subscriptionKeys.filter(Boolean)])
    ),
    underlyingKey: underlying.upstoxInstrumentKey
  };
}

export async function fetchUpstoxMarketFeedAuthorizedUrl(
  credentials: UpstoxCredentials
) {
  const data = await fetchUpstox<{
    authorized_redirect_uri?: string;
    authorizedRedirectUri?: string;
  }>(credentials, "/v3/feed/market-data-feed/authorize");

  const url = data.authorized_redirect_uri ?? data.authorizedRedirectUri;
  if (!url) {
    throw new Error("Upstox market feed did not return an authorized websocket URL");
  }

  return url;
}
