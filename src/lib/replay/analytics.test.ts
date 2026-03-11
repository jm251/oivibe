import { describe, expect, it } from "vitest";

import { buildReplayAnalyticsRows } from "@/lib/replay/analytics";
import { ReplayFrameRecord } from "@/lib/replay/db";

const frames: ReplayFrameRecord[] = [
  {
    symbol: "NIFTY",
    expiry: "2026-03-26",
    sessionDate: "2026-03-11",
    sourceMode: "live",
    degraded: false,
    updatedAt: "2026-03-11T09:15:00.000Z",
    recordedAt: "2026-03-11T09:15:02.000Z",
    spot: 22450,
    rows: [
      {
        strike: 22400,
        call: {
          securityId: "c1",
          strike: 22400,
          optionType: "CALL",
          ltp: 120,
          oi: 1000,
          previousOi: 900,
          deltaOi: 100,
          volume: 150,
          iv: 12,
          bid: 119,
          ask: 121,
          greeks: {
            delta: 0.5,
            gamma: 0.02,
            theta: -5,
            vega: 8
          }
        },
        put: {
          securityId: "p1",
          strike: 22400,
          optionType: "PUT",
          ltp: 95,
          oi: 1200,
          previousOi: 1250,
          deltaOi: -50,
          volume: 175,
          iv: 13,
          bid: 94,
          ask: 96,
          greeks: {
            delta: -0.45,
            gamma: 0.018,
            theta: -4,
            vega: 7
          }
        }
      }
    ],
    aggregates: {
      totalCallOi: 1000,
      totalPutOi: 1200,
      totalCallVolume: 150,
      totalPutVolume: 175,
      pcrOi: 1.2,
      pcrVolume: 1.16,
      topCallWalls: [],
      topPutWalls: [],
      strongestBuildup: null,
      strongestUnwinding: null
    }
  }
];

describe("replay analytics", () => {
  it("flattens replay frames into frame and contract rows", () => {
    const { frameRows, contractRows } = buildReplayAnalyticsRows(frames);

    expect(frameRows).toHaveLength(1);
    expect(frameRows[0]).toMatchObject({
      session_date: "2026-03-11",
      total_call_oi: 1000,
      total_put_oi: 1200
    });

    expect(contractRows).toHaveLength(2);
    expect(contractRows[0]).toMatchObject({
      side: "CALL",
      strike: 22400,
      delta_oi: 100
    });
    expect(contractRows[1]).toMatchObject({
      side: "PUT",
      strike: 22400,
      delta_oi: -50
    });
  });
});
