"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { usePlanStore } from "@/store/plan-store";

class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
  }
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    let payload:
      | {
          code?: string;
          message?: string;
        }
      | undefined;

    try {
      payload = (await response.json()) as {
        code?: string;
        message?: string;
      };
    } catch {
      // no-op
    }

    throw new ApiRequestError(
      payload?.message ?? `HTTP ${response.status}`,
      response.status,
      payload?.code
    );
  }
  return response.json() as Promise<T>;
}

function useTrackApiCall() {
  const incrementApiCalls = usePlanStore((s) => s.incrementApiCalls);
  return incrementApiCalls;
}

export function useSessionStatus() {
  const queryClient = useQueryClient();
  const setConnection = useMarketStore((state) => state.setConnection);
  const track = useTrackApiCall();

  const query = useQuery({
    queryKey: ["session-status"],
    queryFn: async () => {
      track();
      return fetcher<{
        connected: boolean;
        mode: "live" | "mock";
        source: "session" | "runtime" | "env" | "none";
        expiresAt?: string;
        oauthAvailable: boolean;
        tokenRequestAvailable: boolean;
        runtimeStoreAvailable: boolean;
        requiresApproval: boolean;
      }>("/api/session/status");
    },
    refetchInterval: (query) =>
      query.state.data?.requiresApproval ? 15_000 : false
  });

  useEffect(() => {
    if (query.data) {
      setConnection({
        connected: query.data.connected,
        mode: query.data.mode,
        degraded: false,
        message: query.data.requiresApproval
          ? "Upstox approval is required for a fresh live token."
          : undefined,
        approvalRequired: query.data.requiresApproval,
        tokenRequestAvailable: query.data.tokenRequestAvailable,
        oauthAvailable: query.data.oauthAvailable,
        source: query.data.source,
        expiresAt: query.data.expiresAt
      });

      if (query.data.connected && query.data.mode === "live") {
        void queryClient.invalidateQueries({ queryKey: ["expiries"] });
        void queryClient.invalidateQueries({ queryKey: ["option-chain"] });
      }
    }
  }, [query.data, queryClient, setConnection]);

  return query;
}

export function useExpiries(symbol: SupportedSymbol) {
  const expiry = useMarketStore((state) => state.expiry);
  const setExpiry = useMarketStore((state) => state.setExpiry);
  const track = useTrackApiCall();

  const query = useQuery({
    queryKey: ["expiries", symbol],
    queryFn: async () => {
      track();
      return fetcher<{ mode: "live" | "mock"; expiries: string[] }>(`/api/expiries?symbol=${symbol}`);
    }
  });

  useEffect(() => {
    if (!expiry && query.data?.expiries?.length) {
      setExpiry(query.data.expiries[0] ?? "");
    }
  }, [expiry, query.data?.expiries, setExpiry]);

  return query;
}

export function useOptionChain(symbol: SupportedSymbol, expiry: string) {
  const applySnapshot = useMarketStore((state) => state.applySnapshot);
  const setConnection = useMarketStore((state) => state.setConnection);
  const currentMode = useMarketStore((state) => state.mode);
  const replayActive = useMarketStore((state) => state.replayActive);
  const track = useTrackApiCall();

  const query = useQuery({
    queryKey: ["option-chain", symbol, expiry],
    enabled: Boolean(expiry) && !replayActive,
    queryFn: async () => {
      track();
      return fetcher<{
        mode: "live" | "mock";
        expiry: string;
        rows: any[];
        aggregates: any;
        spot: number;
        updatedAt: string;
        degraded?: boolean;
        message?: string;
      }>(`/api/option-chain?symbol=${symbol}&expiry=${expiry}`);
    }
  });

  useEffect(() => {
    if (query.data) {
      applySnapshot({
        mode: query.data.mode,
        expiry: query.data.expiry,
        rows: query.data.rows,
        aggregates: query.data.aggregates,
        spot: query.data.spot,
        updatedAt: query.data.updatedAt,
        degraded: query.data.degraded,
        message: query.data.message
      });
      setConnection({
        connected: query.data.mode === "live",
        mode: query.data.mode,
        degraded: query.data.degraded,
        message: query.data.message,
        approvalRequired: false
      });
    }
  }, [applySnapshot, query.data, setConnection]);

  useEffect(() => {
    if (query.error && currentMode === "live") {
      const approvalRequired =
        query.error instanceof ApiRequestError &&
        query.error.code === "UPSTOX_TOKEN_EXPIRED";

      setConnection({
        connected: false,
        mode: "live",
        degraded: true,
        message:
          approvalRequired
            ? "Upstox token expired. Approve a fresh session to resume live data."
            : query.error instanceof Error
              ? query.error.message
              : "Upstox live snapshot failed.",
        approvalRequired
      });
    }
  }, [currentMode, query.error, setConnection]);

  return query;
}

export function useMarketStream(symbol: SupportedSymbol, expiry: string) {
  const applySnapshot = useMarketStore((state) => state.applySnapshot);
  const applyTick = useMarketStore((state) => state.applyTick);
  const setConnection = useMarketStore((state) => state.setConnection);
  const currentMode = useMarketStore((state) => state.mode);
  const replayActive = useMarketStore((state) => state.replayActive);

  const streamUrl = useMemo(() => {
    if (!expiry) return null;
    return `/api/stream?symbol=${symbol}&expiry=${expiry}`;
  }, [symbol, expiry]);

  useEffect(() => {
    if (!streamUrl || replayActive) return;

    const source = new EventSource(streamUrl);

    source.addEventListener("snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        mode: "live" | "mock";
        rows: any[];
        aggregates: any;
        spot: number;
        ts: string;
        degraded?: boolean;
        message?: string;
      };

      applySnapshot({
        mode: payload.mode,
        expiry,
        rows: payload.rows,
        aggregates: payload.aggregates,
        spot: payload.spot,
        updatedAt: payload.ts,
        degraded: payload.degraded,
        message: payload.message
      });
      setConnection({
        connected: payload.mode === "live",
        mode: payload.mode,
        degraded: payload.degraded,
        message: payload.message,
        approvalRequired: false
      });
    });

    source.addEventListener("tick", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        updates: any[];
        aggregates: any;
        spot: number;
        ts: string;
      };
      applyTick(payload);
    });

    source.addEventListener("error", (event) => {
      const messageEvent = event as MessageEvent<string>;

      if (messageEvent.data) {
        try {
          const payload = JSON.parse(messageEvent.data) as {
            code: string;
            message: string;
            recoverable: boolean;
          };

          if (currentMode === "live") {
            setConnection({
              connected: payload.code !== "UPSTOX_TOKEN_EXPIRED",
              mode: "live",
              degraded: true,
              message:
                payload.code === "UPSTOX_TOKEN_EXPIRED"
                  ? "Upstox token expired. Approve a fresh session to resume live data."
                  : payload.message,
              approvalRequired: payload.code === "UPSTOX_TOKEN_EXPIRED"
            });
          }
        } catch {
          // EventSource reconnect handles transient disconnects.
        }
      }
    });

    return () => {
      source.close();
    };
  }, [applySnapshot, applyTick, currentMode, expiry, replayActive, setConnection, streamUrl]);
}
