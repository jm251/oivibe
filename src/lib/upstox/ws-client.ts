import path from "node:path";

import protobuf from "protobufjs";
import WebSocket from "ws";

import { safeNumber } from "@/lib/utils";
import { fetchUpstoxMarketFeedAuthorizedUrl } from "@/lib/upstox/rest";
import { UpstoxCredentials, UpstoxWsFeedUpdate } from "@/lib/upstox/types";

type ConnectionState = "connecting" | "connected" | "error" | "closed";

interface FeedResponseMessage {
  feeds?: Record<string, Record<string, unknown>>;
}

interface UpstoxBatch {
  updates: UpstoxWsFeedUpdate[];
  spot?: number;
}

const PROTO_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "upstox",
  "MarketDataFeedV3.proto"
);

let feedResponseTypePromise: Promise<protobuf.Type> | null = null;

function loadFeedResponseType() {
  if (!feedResponseTypePromise) {
    feedResponseTypePromise = protobuf
      .load(PROTO_PATH)
      .then((root) =>
        root.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse")
      );
  }
  return feedResponseTypePromise;
}

function extractSpot(feed: Record<string, unknown>) {
  const fullFeed = feed.fullFeed as Record<string, unknown> | undefined;
  const indexFeed = fullFeed?.indexFF as Record<string, unknown> | undefined;
  const ltpc = indexFeed?.ltpc as Record<string, unknown> | undefined;
  return safeNumber(ltpc?.ltp, 0);
}

function extractUpdate(
  securityId: string,
  feed: Record<string, unknown>
): UpstoxWsFeedUpdate | null {
  const fullFeed = feed.fullFeed as Record<string, unknown> | undefined;
  const marketFeed = fullFeed?.marketFF as Record<string, unknown> | undefined;
  const firstLevel = feed.firstLevelWithGreeks as Record<string, unknown> | undefined;
  const ltpc =
    (marketFeed?.ltpc as Record<string, unknown> | undefined) ??
    (feed.ltpc as Record<string, unknown> | undefined) ??
    (firstLevel?.ltpc as Record<string, unknown> | undefined);

  const marketLevel = marketFeed?.marketLevel as Record<string, unknown> | undefined;
  const bidAskQuote = Array.isArray(marketLevel?.bidAskQuote)
    ? (marketLevel?.bidAskQuote as Array<Record<string, unknown>>)
    : [];
  const firstDepth =
    bidAskQuote[0] ??
    (firstLevel?.firstDepth as Record<string, unknown> | undefined) ??
    ({} as Record<string, unknown>);

  const optionGreeks =
    (marketFeed?.optionGreeks as Record<string, unknown> | undefined) ??
    (firstLevel?.optionGreeks as Record<string, unknown> | undefined) ??
    {};

  const ltp = safeNumber(ltpc?.ltp, NaN);
  if (!Number.isFinite(ltp)) {
    return null;
  }

  return {
    securityId,
    ltp,
    volume: safeNumber(marketFeed?.vtt ?? firstLevel?.vtt, 0),
    oi: safeNumber(marketFeed?.oi ?? firstLevel?.oi, 0),
    bid: safeNumber(firstDepth.bidP, 0),
    ask: safeNumber(firstDepth.askP, 0),
    iv: safeNumber(marketFeed?.iv ?? firstLevel?.iv, 0),
    greeks: {
      delta: safeNumber(optionGreeks.delta, 0),
      gamma: safeNumber(optionGreeks.gamma, 0),
      theta: safeNumber(optionGreeks.theta, 0),
      vega: safeNumber(optionGreeks.vega, 0)
    }
  };
}

export class UpstoxWsClient {
  private ws: WebSocket | null = null;
  private subscribedKeys = new Set<string>();
  private manuallyClosed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly credentials: UpstoxCredentials,
    private readonly onBatch: (batch: UpstoxBatch) => void,
    private readonly onStateChange?: (state: ConnectionState) => void
  ) {}

  async connect() {
    this.manuallyClosed = false;
    this.onStateChange?.("connecting");

    const authorizedUrl = await fetchUpstoxMarketFeedAuthorizedUrl(this.credentials);
    this.ws = new WebSocket(authorizedUrl);

    this.ws.on("open", () => {
      this.onStateChange?.("connected");
      this.flushSubscriptions();
    });

    this.ws.on("message", async (data) => {
      try {
        const FeedResponse = await loadFeedResponseType();
        const decoded = FeedResponse.decode(new Uint8Array(data as Buffer));
        const payload = FeedResponse.toObject(decoded, {
          longs: Number,
          enums: String,
          defaults: false
        }) as FeedResponseMessage;

        const updates: UpstoxWsFeedUpdate[] = [];
        let spot: number | undefined;

        for (const [instrumentKey, feed] of Object.entries(payload.feeds ?? {})) {
          if (!feed || typeof feed !== "object") {
            continue;
          }

          const fullFeed = (feed as Record<string, unknown>).fullFeed as
            | Record<string, unknown>
            | undefined;

          if (fullFeed?.indexFF) {
            const nextSpot = extractSpot(feed as Record<string, unknown>);
            if (Number.isFinite(nextSpot) && nextSpot > 0) {
              spot = nextSpot;
            }
            continue;
          }

          const update = extractUpdate(instrumentKey, feed as Record<string, unknown>);
          if (update) {
            updates.push(update);
          }
        }

        if (updates.length || typeof spot === "number") {
          this.onBatch({ updates, spot });
        }
      } catch {
        this.onStateChange?.("error");
      }
    });

    this.ws.on("close", () => {
      this.ws = null;
      this.onStateChange?.("closed");

      if (!this.manuallyClosed) {
        this.onStateChange?.("error");
        this.reconnectTimer = setTimeout(() => {
          void this.connect();
        }, 2_000);
      }
    });

    this.ws.on("error", () => {
      this.onStateChange?.("error");
    });
  }

  subscribe(instrumentKeys: string[]) {
    instrumentKeys.forEach((key) => this.subscribedKeys.add(key));
    this.flushSubscriptions();
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private flushSubscriptions() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.subscribedKeys.size) {
      return;
    }

    const keys = Array.from(this.subscribedKeys);
    for (let index = 0; index < keys.length; index += 100) {
      this.ws.send(
        Buffer.from(
          JSON.stringify({
            guid: `oi-vibe-${index}`,
            method: "sub",
            data: {
              mode: "full",
              instrumentKeys: keys.slice(index, index + 100)
            }
          })
        )
      );
    }
  }
}
