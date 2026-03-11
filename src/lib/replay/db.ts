import Dexie, { type Table } from "dexie";

import { ChainAggregates, OptionChainRow, SupportedSymbol } from "@/lib/types";

export interface ReplayFrameRecord {
  id?: number;
  symbol: SupportedSymbol;
  expiry: string;
  sourceMode: "live" | "mock";
  degraded: boolean;
  message?: string;
  updatedAt: string;
  recordedAt: string;
  spot: number;
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
}

const MAX_REPLAY_FRAMES_PER_CHAIN = 360;

class OiVibeReplayDb extends Dexie {
  frames!: Table<ReplayFrameRecord, number>;

  constructor() {
    super("oi-vibe-replay");

    this.version(1).stores({
      frames: "++id, [symbol+expiry], symbol, expiry, updatedAt, recordedAt"
    });
  }
}

let replayDbSingleton: OiVibeReplayDb | null = null;

function getReplayDb() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!replayDbSingleton) {
    replayDbSingleton = new OiVibeReplayDb();
  }

  return replayDbSingleton;
}

export async function recordReplayFrame(
  frame: Omit<ReplayFrameRecord, "id" | "recordedAt">
) {
  const db = getReplayDb();
  if (!db) return;

  const recordedAt = new Date().toISOString();

  await db.transaction("rw", db.frames, async () => {
    await db.frames.add({
      ...frame,
      recordedAt
    });

    const frames = await db.frames
      .where("[symbol+expiry]")
      .equals([frame.symbol, frame.expiry])
      .sortBy("updatedAt");

    const overflow = frames.length - MAX_REPLAY_FRAMES_PER_CHAIN;
    if (overflow > 0) {
      const idsToDelete = frames
        .slice(0, overflow)
        .map((item) => item.id)
        .filter((value): value is number => typeof value === "number");

      if (idsToDelete.length) {
        await db.frames.bulkDelete(idsToDelete);
      }
    }
  });
}

export async function listReplayFrames(
  symbol: SupportedSymbol,
  expiry: string,
  limit = MAX_REPLAY_FRAMES_PER_CHAIN
) {
  const db = getReplayDb();
  if (!db || !expiry) return [];

  const frames = await db.frames
    .where("[symbol+expiry]")
    .equals([symbol, expiry])
    .sortBy("updatedAt");

  return frames.slice(-limit);
}

export async function clearReplayFrames(symbol: SupportedSymbol, expiry: string) {
  const db = getReplayDb();
  if (!db || !expiry) return;

  const ids = await db.frames
    .where("[symbol+expiry]")
    .equals([symbol, expiry])
    .primaryKeys();

  if (ids.length) {
    await db.frames.bulkDelete(ids);
  }
}
