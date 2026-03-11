import { describe, expect, it } from "vitest";

import {
  buildReplayTimeline,
  deriveReplaySessionDate,
  summarizeReplayFrames,
  summarizeReplaySessions
} from "@/lib/replay/utils";

const frames = [
  {
    symbol: "NIFTY" as const,
    expiry: "2026-03-26",
    sessionDate: "2026-03-11",
    sourceMode: "live" as const,
    degraded: false,
    updatedAt: "2026-03-11T09:15:00.000Z",
    recordedAt: "2026-03-11T09:15:01.000Z",
    spot: 22450,
    rows: [],
    aggregates: {
      totalCallOi: 100,
      totalPutOi: 200,
      totalCallVolume: 10,
      totalPutVolume: 20,
      pcrOi: 2,
      pcrVolume: 2,
      topCallWalls: [],
      topPutWalls: [],
      strongestBuildup: null,
      strongestUnwinding: null
    }
  },
  {
    symbol: "NIFTY" as const,
    expiry: "2026-03-26",
    sessionDate: "2026-03-11",
    sourceMode: "live" as const,
    degraded: false,
    updatedAt: "2026-03-11T09:15:05.000Z",
    recordedAt: "2026-03-11T09:15:06.000Z",
    spot: 22480,
    rows: [],
    aggregates: {
      totalCallOi: 110,
      totalPutOi: 230,
      totalCallVolume: 12,
      totalPutVolume: 22,
      pcrOi: 2.1,
      pcrVolume: 1.8,
      topCallWalls: [],
      topPutWalls: [],
      strongestBuildup: null,
      strongestUnwinding: null
    }
  }
];

describe("replay utils", () => {
  it("builds a chart timeline from cached frames", () => {
    const timeline = buildReplayTimeline(frames);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({
      spot: 22450,
      callOi: 100,
      putOi: 200
    });
  });

  it("summarizes cached replay coverage", () => {
    const summary = summarizeReplayFrames(frames);

    expect(summary).toEqual({
      count: 2,
      firstUpdatedAt: "2026-03-11T09:15:00.000Z",
      lastUpdatedAt: "2026-03-11T09:15:05.000Z",
      latestSpot: 22480
    });
  });

  it("derives and groups replay sessions by day", () => {
    const sessions = summarizeReplaySessions([
      ...frames,
      {
        ...frames[1],
        sessionDate: "2026-03-10",
        updatedAt: "2026-03-10T09:15:05.000Z",
        recordedAt: "2026-03-10T09:15:06.000Z",
        degraded: true
      }
    ]);

    expect(deriveReplaySessionDate("2026-03-11T12:00:00.000Z")).toBe("2026-03-11");
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      sessionDate: "2026-03-11",
      frameCount: 2,
      degradedCount: 0
    });
    expect(sessions[1]).toMatchObject({
      sessionDate: "2026-03-10",
      frameCount: 1,
      degradedCount: 1
    });
  });
});
