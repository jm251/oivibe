"use client";

import { useEffect, useRef } from "react";

import { recordReplayFrame } from "@/lib/replay/db";
import { useMarketStore } from "@/store/market-store";

const MIN_REPLAY_RECORD_INTERVAL_MS = 4_000;

export function useReplayRecorder() {
  const {
    symbol,
    expiry,
    mode,
    degraded,
    message,
    rows,
    aggregates,
    spot,
    updatedAt,
    replayActive
  } = useMarketStore();

  const lastRecordedKeyRef = useRef("");
  const lastRecordedTsRef = useRef(0);

  useEffect(() => {
    lastRecordedKeyRef.current = "";
    lastRecordedTsRef.current = 0;
  }, [symbol, expiry]);

  useEffect(() => {
    if (!expiry || !updatedAt || !rows.length || replayActive) {
      return;
    }

    const key = `${symbol}:${expiry}:${updatedAt}`;
    if (lastRecordedKeyRef.current === key) {
      return;
    }

    const ts = new Date(updatedAt).getTime();
    if (
      Number.isFinite(ts) &&
      lastRecordedTsRef.current > 0 &&
      ts - lastRecordedTsRef.current < MIN_REPLAY_RECORD_INTERVAL_MS
    ) {
      return;
    }

    lastRecordedKeyRef.current = key;
    lastRecordedTsRef.current = Number.isFinite(ts) ? ts : Date.now();

    void recordReplayFrame({
      symbol,
      expiry,
      sourceMode: mode,
      degraded,
      message,
      updatedAt,
      spot,
      rows,
      aggregates
    });
  }, [
    aggregates,
    degraded,
    expiry,
    message,
    mode,
    replayActive,
    rows,
    spot,
    symbol,
    updatedAt
  ]);
}
