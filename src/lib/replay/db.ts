import Dexie, { type Table } from "dexie";

import {
  buildReplaySessionTransfer,
  type ReplaySessionTransfer
} from "@/lib/replay/transfer";
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

const MAX_REPLAY_FRAMES_PER_SESSION = 360;
const MAX_REPLAY_SESSIONS_PER_CHAIN = 5;

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

async function trimReplaySessionFrames(
  db: OiVibeReplayDb,
  symbol: SupportedSymbol,
  expiry: string,
  sessionDate: string
) {
  const frames = await db.frames
    .where("[symbol+expiry+sessionDate]")
    .equals([symbol, expiry, sessionDate])
    .sortBy("updatedAt");

  const overflow = frames.length - MAX_REPLAY_FRAMES_PER_SESSION;
  if (overflow <= 0) {
    return;
  }

  const idsToDelete = frames
    .slice(0, overflow)
    .map((item) => item.id)
    .filter((value): value is number => typeof value === "number");

  if (idsToDelete.length) {
    await db.frames.bulkDelete(idsToDelete);
  }
}

async function trimReplaySessions(
  db: OiVibeReplayDb,
  symbol: SupportedSymbol,
  expiry: string
) {
  const frames = await db.frames
    .where("[symbol+expiry]")
    .equals([symbol, expiry])
    .sortBy("updatedAt");

  const sessions = summarizeReplaySessions(frames);
  const staleSessions = sessions.slice(MAX_REPLAY_SESSIONS_PER_CHAIN);

  for (const session of staleSessions) {
    const idsToDelete = await db.frames
      .where("[symbol+expiry+sessionDate]")
      .equals([symbol, expiry, session.sessionDate])
      .primaryKeys();

    if (idsToDelete.length) {
      await db.frames.bulkDelete(idsToDelete);
    }
  }
}

async function enforceReplayLimits(
  db: OiVibeReplayDb,
  symbol: SupportedSymbol,
  expiry: string,
  sessionDate: string
) {
  await trimReplaySessionFrames(db, symbol, expiry, sessionDate);
  await trimReplaySessions(db, symbol, expiry);
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
    await enforceReplayLimits(
      db,
      frame.symbol,
      frame.expiry,
      frame.sessionDate || deriveReplaySessionDate(frame.updatedAt)
    );
  });
}

export async function listReplayFrames(
  symbol: SupportedSymbol,
  expiry: string,
  limit = MAX_REPLAY_FRAMES_PER_SESSION,
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

export async function exportReplaySession(
  symbol: SupportedSymbol,
  expiry: string,
  sessionDate: string
) {
  const frames = await listReplayFrames(
    symbol,
    expiry,
    MAX_REPLAY_FRAMES_PER_SESSION,
    sessionDate
  );

  if (!frames.length) {
    return null;
  }

  return buildReplaySessionTransfer({
    version: 1,
    exportedAt: new Date().toISOString(),
    symbol,
    expiry,
    sessionDate,
    frames: frames.map(({ id: _id, ...frame }) => frame)
  });
}

export async function importReplaySession(payload: ReplaySessionTransfer) {
  const db = getReplayDb();
  if (!db) {
    return {
      importedCount: 0,
      sessionDate: payload.sessionDate
    };
  }

  const frames = payload.frames
    .map((frame) => ({
      ...frame,
      sessionDate: frame.sessionDate || payload.sessionDate
    }))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  await db.transaction("rw", db.frames, async () => {
    const existingIds = await db.frames
      .where("[symbol+expiry+sessionDate]")
      .equals([payload.symbol, payload.expiry, payload.sessionDate])
      .primaryKeys();

    if (existingIds.length) {
      await db.frames.bulkDelete(existingIds);
    }

    await db.frames.bulkAdd(frames);
    await enforceReplayLimits(
      db,
      payload.symbol,
      payload.expiry,
      payload.sessionDate
    );
  });

  const importedFrames = await listReplayFrames(
    payload.symbol,
    payload.expiry,
    MAX_REPLAY_FRAMES_PER_SESSION,
    payload.sessionDate
  );

  return {
    importedCount: importedFrames.length,
    sessionDate: payload.sessionDate
  };
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
