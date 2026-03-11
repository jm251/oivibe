import { describe, expect, it } from "vitest";

import {
  buildReplaySessionFilename,
  buildReplaySessionTransfer,
  parseReplaySessionTransfer
} from "@/lib/replay/transfer";

const payload = {
  version: 1 as const,
  exportedAt: "2026-03-11T10:00:00.000Z",
  symbol: "NIFTY" as const,
  expiry: "2026-03-26",
  sessionDate: "2026-03-11",
  frames: [
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
    }
  ]
};

describe("replay transfer", () => {
  it("builds and parses a replay session export", () => {
    const built = buildReplaySessionTransfer(payload);
    const parsed = parseReplaySessionTransfer(built);

    expect(parsed.sessionDate).toBe("2026-03-11");
    expect(buildReplaySessionFilename(parsed)).toBe(
      "oi-vibe-nifty-2026-03-26-2026-03-11.json"
    );
  });

  it("rejects frame metadata mismatches", () => {
    expect(() =>
      parseReplaySessionTransfer({
        ...payload,
        frames: [
          {
            ...payload.frames[0],
            symbol: "BANKNIFTY"
          }
        ]
      })
    ).toThrow(/does not match export symbol/i);
  });
});
