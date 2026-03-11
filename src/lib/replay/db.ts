import Dexie, { type Table } from "dexie";

import { deriveReplaySessionDate, summarizeReplaySessions } from "@/lib/replay/utils";
import { ChainAggregates, OptionChainRow, SupportedSymbol } from "@/lib/types";

export interface ReplayFrameRecord {
  id?: number;
  symbol: SupportedSymbol;
  expiry: string;
  sessionDate: string;
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

    this.version(2)
      .stores({
        frames:
          "++id, [symbol+expiry], [symbol+expiry+sessionDate], sessionDate, symbol, expiry, updatedAt, recordedAt"
      })
      .upgrade(async (tx) => {
        await tx
          .table("frames")
          .toCollection()
          .modify((frame: ReplayFrameRecord) => {
            frame.sessionDate =
              frame.sessionDate || deriveReplaySessionDate(frame.updatedAt);
          });
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
      sessionDate: frame.sessionDate || deriveReplaySessionDate(frame.updatedAt),
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
  limit = MAX_REPLAY_FRAMES_PER_CHAIN,
  sessionDate?: string
) {
  const db = getReplayDb();
  if (!db || !expiry) return [];

  const frames = sessionDate
    ? await db.frames
        .where("[symbol+expiry+sessionDate]")
        .equals([symbol, expiry, sessionDate])
        .sortBy("updatedAt")
    : await db.frames
        .where("[symbol+expiry]")
        .equals([symbol, expiry])
        .sortBy("updatedAt");

  return frames.slice(-limit);
}

export async function listReplaySessions(symbol: SupportedSymbol, expiry: string) {
  const db = getReplayDb();
  if (!db || !expiry) return [];

  const frames = await db.frames
    .where("[symbol+expiry]")
    .equals([symbol, expiry])
    .sortBy("updatedAt");

  return summarizeReplaySessions(frames);
}

export async function clearReplayFrames(
  symbol: SupportedSymbol,
  expiry: string,
  sessionDate?: string
) {
  const db = getReplayDb();
  if (!db || !expiry) return;

  const ids = sessionDate
    ? await db.frames
        .where("[symbol+expiry+sessionDate]")
        .equals([symbol, expiry, sessionDate])
        .primaryKeys()
    : await db.frames
        .where("[symbol+expiry]")
        .equals([symbol, expiry])
        .primaryKeys();

  if (ids.length) {
    await db.frames.bulkDelete(ids);
  }
}
