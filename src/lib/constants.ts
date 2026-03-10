import { UnderlyingRef } from "@/lib/types";

export const UNDERLYINGS: Record<string, UnderlyingRef> = {
  NIFTY: {
    symbol: "NIFTY",
    displayName: "NIFTY 50",
    upstoxInstrumentKey: "NSE_INDEX|Nifty 50",
    upstoxUnderlyingSymbol: "NIFTY",
    lotSize: 50,
    strikeStep: 50
  },
  BANKNIFTY: {
    symbol: "BANKNIFTY",
    displayName: "NIFTY BANK",
    upstoxInstrumentKey: "NSE_INDEX|Nifty Bank",
    upstoxUnderlyingSymbol: "BANKNIFTY",
    lotSize: 15,
    strikeStep: 100
  },
  FINNIFTY: {
    symbol: "FINNIFTY",
    displayName: "NIFTY FIN SERVICE",
    upstoxInstrumentKey: "NSE_INDEX|Nifty Fin Service",
    upstoxUnderlyingSymbol: "FINNIFTY",
    lotSize: 25,
    strikeStep: 50
  }
};

export const DEFAULT_SYMBOL = "NIFTY" as const;
export const STREAM_HEARTBEAT_MS = 10_000;
export const LIVE_SNAPSHOT_REFRESH_MS = 30_000;
export const MOCK_TICK_MS = 1_200;
export const OPTION_CHAIN_THROTTLE_MS = 3_000;
