import { describe, expect, it } from "vitest";

import { buildReplayTimeline, summarizeReplayFrames } from "@/lib/replay/utils";

const frames = [
  {
    symbol: "NIFTY" as const,
    expiry: "2026-03-26",
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
});
