import {
  LIVE_SNAPSHOT_REFRESH_MS,
  MOCK_TICK_MS,
  STREAM_HEARTBEAT_MS
} from "@/lib/constants";
import { applyTickUpdates, computeAggregates } from "@/lib/market/analytics";
import { mockMarketEngine } from "@/lib/mock/simulator";
import { resolveRuntimeCredentials } from "@/lib/session/runtime";
import {
  fetchUpstoxOptionChainSnapshot
} from "@/lib/upstox/rest";
import { UpstoxCredentials } from "@/lib/upstox/types";
import { UpstoxWsClient } from "@/lib/upstox/ws-client";
import { OptionChainSnapshot, SupportedSymbol, TickDelta } from "@/lib/types";

export type StreamEvent =
  | {
      event: "snapshot";
      data: {
        mode: "live" | "mock";
        rows: OptionChainSnapshot["rows"];
        aggregates: OptionChainSnapshot["aggregates"];
        spot: number;
        ts: string;
      };
    }
  | {
      event: "tick";
      data: {
        updates: TickDelta[];
        aggregates: OptionChainSnapshot["aggregates"];
        spot: number;
        ts: string;
      };
    }
  | { event: "heartbeat"; data: { ts: string } }
  | {
      event: "error";
      data: { code: string; message: string; recoverable: boolean };
    };

type Listener = (event: StreamEvent) => void;

interface Channel {
  key: string;
  symbol: SupportedSymbol;
  expiry: string;
  listeners: Set<Listener>;
  mode: "live" | "mock";
  snapshot: OptionChainSnapshot | null;
  oiBySecurity: Map<string, number>;
  heartbeatTimer: NodeJS.Timeout | null;
  tickTimer: NodeJS.Timeout | null;
  refreshTimer: NodeJS.Timeout | null;
  wsClient: UpstoxWsClient | null;
  booting: Promise<void> | null;
}

class StreamHub {
  private channels = new Map<string, Channel>();

  subscribe(symbol: SupportedSymbol, expiry: string, listener: Listener) {
    const key = `${symbol}:${expiry}`;
    let channel = this.channels.get(key);

    if (!channel) {
      channel = {
        key,
        symbol,
        expiry,
        listeners: new Set(),
        mode: "mock",
        snapshot: null,
        oiBySecurity: new Map(),
        heartbeatTimer: null,
        tickTimer: null,
        refreshTimer: null,
        wsClient: null,
        booting: null
      };
      this.channels.set(key, channel);
    }

    channel.listeners.add(listener);

    if (!channel.booting) {
      channel.booting = this.startChannel(channel);
    }

    if (channel.snapshot) {
      listener({
        event: "snapshot",
        data: {
          mode: channel.snapshot.mode,
          rows: channel.snapshot.rows,
          aggregates: channel.snapshot.aggregates,
          spot: channel.snapshot.spot,
          ts: channel.snapshot.updatedAt
        }
      });
    }

    return () => {
      channel.listeners.delete(listener);
      if (channel.listeners.size === 0) {
        this.stopChannel(channel);
        this.channels.delete(key);
      }
    };
  }

  getSnapshot(symbol: SupportedSymbol, expiry: string) {
    const key = `${symbol}:${expiry}`;
    return this.channels.get(key)?.snapshot ?? null;
  }

  private async startChannel(channel: Channel) {
    const creds = await resolveRuntimeCredentials();

    if (creds.credentials) {
      try {
        await this.bootLive(channel, creds.credentials);
        return;
      } catch (error) {
        this.broadcast(channel, {
          event: "error",
          data: {
            code: "LIVE_INIT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Live mode failed. Falling back to mock.",
            recoverable: true
          }
        });
      }
    }

    this.bootMock(channel);
  }

  private bootMock(channel: Channel) {
    channel.mode = "mock";

    const snapshot = mockMarketEngine.getSnapshot(channel.symbol, channel.expiry);
    channel.snapshot = snapshot;
    channel.oiBySecurity = new Map(
      snapshot.rows.flatMap((row) => [
        [row.call.securityId, row.call.oi],
        [row.put.securityId, row.put.oi]
      ])
    );

    this.broadcastSnapshot(channel, snapshot);

    channel.tickTimer = setInterval(() => {
      const { snapshot: next, updates } = mockMarketEngine.tick(
        channel.symbol,
        channel.expiry
      );
      channel.snapshot = {
        ...next,
        mode: "mock"
      };

      this.broadcast(channel, {
        event: "tick",
        data: {
          updates,
          aggregates: channel.snapshot.aggregates,
          spot: channel.snapshot.spot,
          ts: channel.snapshot.updatedAt
        }
      });
    }, MOCK_TICK_MS);

    channel.heartbeatTimer = setInterval(() => {
      this.broadcast(channel, {
        event: "heartbeat",
        data: { ts: new Date().toISOString() }
      });
    }, STREAM_HEARTBEAT_MS);
  }

  private async bootLive(channel: Channel, credentials: UpstoxCredentials) {
    channel.mode = "live";

    const initial = await fetchUpstoxOptionChainSnapshot(
      credentials,
      channel.symbol,
      channel.expiry
    );

    if (!initial.rows.length) {
      throw new Error("No live option chain rows returned");
    }

    channel.snapshot = {
      mode: "live",
      symbol: channel.symbol,
      expiry: initial.expiry,
      spot: initial.spot,
      rows: initial.rows,
      aggregates: computeAggregates(initial.rows),
      updatedAt: new Date().toISOString()
    };

    channel.oiBySecurity = new Map(
      channel.snapshot.rows.flatMap((row) => [
        [row.call.securityId, row.call.oi],
        [row.put.securityId, row.put.oi]
      ])
    );

    this.broadcastSnapshot(channel, channel.snapshot);

    channel.wsClient = new UpstoxWsClient(
      credentials,
      ({ updates, spot }) => {
        if (!channel.snapshot) {
          return;
        }

        const normalizedUpdates: TickDelta[] = [];

        for (const tick of updates) {
          if (
            !tick.securityId ||
            typeof tick.ltp !== "number" ||
            typeof tick.volume !== "number" ||
            typeof tick.oi !== "number"
          ) {
            continue;
          }

          const previous = channel.oiBySecurity.get(tick.securityId) ?? tick.oi;
          const deltaOi = tick.oi - previous;
          channel.oiBySecurity.set(tick.securityId, tick.oi);

          normalizedUpdates.push({
            securityId: tick.securityId,
            ltp: tick.ltp,
            volume: tick.volume,
            oi: tick.oi,
            deltaOi,
            bid: tick.bid,
            ask: tick.ask,
            iv: tick.iv,
            greeks: tick.greeks
          });
        }

        const previousSpot = channel.snapshot.spot;
        const nextRows = applyTickUpdates(channel.snapshot.rows, normalizedUpdates);
        const nextSpot =
          typeof spot === "number" && spot > 0 ? spot : channel.snapshot.spot;

        channel.snapshot = {
          ...channel.snapshot,
          spot: nextSpot,
          rows: nextRows,
          aggregates: computeAggregates(nextRows),
          updatedAt: new Date().toISOString()
        };

        if (normalizedUpdates.length || nextSpot !== previousSpot) {
          this.broadcast(channel, {
            event: "tick",
            data: {
              updates: normalizedUpdates,
              aggregates: channel.snapshot.aggregates,
              spot: channel.snapshot.spot,
              ts: channel.snapshot.updatedAt
            }
          });
        }
      },
      (state) => {
        if (state === "error") {
          this.broadcast(channel, {
            event: "error",
            data: {
              code: "LIVE_WS_ERROR",
              message: "Live websocket disconnected. Auto-reconnecting.",
              recoverable: true
            }
          });
        }
      }
    );

    void channel.wsClient.connect().catch(() => {
      this.broadcast(channel, {
        event: "error",
        data: {
          code: "LIVE_WS_CONNECT_FAILED",
          message: "Failed to initialize Upstox live websocket.",
          recoverable: true
        }
      });
    });
    channel.wsClient.subscribe(initial.subscriptionKeys);

    channel.refreshTimer = setInterval(async () => {
      if (!channel.snapshot) return;
      try {
        const refreshed = await fetchUpstoxOptionChainSnapshot(
          credentials,
          channel.symbol,
          channel.snapshot.expiry
        );

        if (!refreshed.rows.length) return;

        channel.snapshot = {
          ...channel.snapshot,
          mode: "live",
          spot: refreshed.spot,
          rows: refreshed.rows,
          aggregates: computeAggregates(refreshed.rows),
          updatedAt: new Date().toISOString()
        };

        channel.oiBySecurity = new Map(
          channel.snapshot.rows.flatMap((row) => [
            [row.call.securityId, row.call.oi],
            [row.put.securityId, row.put.oi]
          ])
        );

        this.broadcastSnapshot(channel, channel.snapshot);
      } catch {
        this.broadcast(channel, {
          event: "error",
          data: {
            code: "LIVE_REFRESH_FAILED",
            message: "Failed to refresh live snapshot.",
            recoverable: true
          }
        });
      }
    }, LIVE_SNAPSHOT_REFRESH_MS);

    channel.heartbeatTimer = setInterval(() => {
      this.broadcast(channel, {
        event: "heartbeat",
        data: { ts: new Date().toISOString() }
      });
    }, STREAM_HEARTBEAT_MS);
  }

  private stopChannel(channel: Channel) {
    channel.wsClient?.disconnect();
    if (channel.tickTimer) clearInterval(channel.tickTimer);
    if (channel.heartbeatTimer) clearInterval(channel.heartbeatTimer);
    if (channel.refreshTimer) clearInterval(channel.refreshTimer);
  }

  private broadcastSnapshot(channel: Channel, snapshot: OptionChainSnapshot) {
    this.broadcast(channel, {
      event: "snapshot",
      data: {
        mode: snapshot.mode,
        rows: snapshot.rows,
        aggregates: snapshot.aggregates,
        spot: snapshot.spot,
        ts: snapshot.updatedAt
      }
    });
  }

  private broadcast(channel: Channel, event: StreamEvent) {
    channel.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // listener failures should not break stream fanout
      }
    });
  }
}

export const streamHub = new StreamHub();
