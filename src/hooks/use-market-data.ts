"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { usePlanStore } from "@/store/plan-store";

const AUTO_REAUTH_KEY = "oi_vibe_auto_reauth_attempted";

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

function clearAutoReauthAttempt() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTO_REAUTH_KEY);
}

function triggerAutoReauth() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(AUTO_REAUTH_KEY) === "1") return;

  window.sessionStorage.setItem(AUTO_REAUTH_KEY, "1");
  window.location.assign("/api/upstox/login?returnTo=/");
}

function useTrackApiCall() {
  const incrementApiCalls = usePlanStore((s) => s.incrementApiCalls);
  return incrementApiCalls;
}

export function useSessionStatus() {
  const setConnection = useMarketStore((state) => state.setConnection);
  const track = useTrackApiCall();

  const query = useQuery({
    queryKey: ["session-status"],
    queryFn: async () => {
      track();
      return fetcher<{ connected: boolean; mode: "live" | "mock" }>("/api/session/status");
    }
  });

  useEffect(() => {
    if (query.data) {
      setConnection({
        connected: query.data.connected,
        mode: query.data.mode,
        degraded: false,
        message: undefined
      });

      if (query.data.connected && query.data.mode === "live") {
        clearAutoReauthAttempt();
      }
    }
  }, [query.data, setConnection]);

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
        message: query.data.message
      });

      if (query.data.mode === "live" && !query.data.degraded) {
        clearAutoReauthAttempt();
      }
    }
  }, [applySnapshot, query.data, setConnection]);

  useEffect(() => {
    if (query.error && currentMode === "live") {
      setConnection({
        connected: true,
        mode: "live",
        degraded: true,
        message:
          query.error instanceof Error
            ? query.error.message
            : "Upstox live snapshot failed."
      });

      if (
        query.error instanceof ApiRequestError &&
        query.error.code === "UPSTOX_TOKEN_EXPIRED"
      ) {
        triggerAutoReauth();
      }
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
        message: payload.message
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
              connected: true,
              mode: "live",
              degraded: true,
              message: payload.message
            });
          }

          if (payload.code === "UPSTOX_TOKEN_EXPIRED") {
            triggerAutoReauth();
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
