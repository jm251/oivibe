"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { usePlanStore } from "@/store/plan-store";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
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
      setConnection({ connected: query.data.connected, mode: query.data.mode });
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
  const track = useTrackApiCall();

  const query = useQuery({
    queryKey: ["option-chain", symbol, expiry],
    enabled: Boolean(expiry),
    queryFn: async () => {
      track();
      return fetcher<{
        mode: "live" | "mock";
        expiry: string;
        rows: any[];
        aggregates: any;
        spot: number;
        updatedAt: string;
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
        updatedAt: query.data.updatedAt
      });
      setConnection({ connected: query.data.mode === "live", mode: query.data.mode });
    }
  }, [applySnapshot, query.data, setConnection]);

  return query;
}

export function useMarketStream(symbol: SupportedSymbol, expiry: string) {
  const applySnapshot = useMarketStore((state) => state.applySnapshot);
  const applyTick = useMarketStore((state) => state.applyTick);

  const streamUrl = useMemo(() => {
    if (!expiry) return null;
    return `/api/stream?symbol=${symbol}&expiry=${expiry}`;
  }, [symbol, expiry]);

  useEffect(() => {
    if (!streamUrl) return;

    const source = new EventSource(streamUrl);

    source.addEventListener("snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        mode: "live" | "mock";
        rows: any[];
        aggregates: any;
        spot: number;
        ts: string;
      };

      applySnapshot({
        mode: payload.mode,
        expiry,
        rows: payload.rows,
        aggregates: payload.aggregates,
        spot: payload.spot,
        updatedAt: payload.ts
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

    source.addEventListener("error", () => {
      // EventSource reconnect handles transient disconnects.
    });

    return () => {
      source.close();
    };
  }, [applySnapshot, applyTick, expiry, streamUrl]);
}
