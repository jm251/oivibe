import { buildVolSurfaceMesh, buildVolSurfacePoints } from "@/lib/market/vol-surface";
import { OptionChainRow } from "@/lib/types";

const rows: OptionChainRow[] = [
  {
    strike: 22400,
    call: {
      securityId: "c1",
      strike: 22400,
      optionType: "CALL",
      ltp: 1,
      oi: 1,
      previousOi: 1,
      deltaOi: 0,
      volume: 1,
      iv: 12,
      bid: 1,
      ask: 1,
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }
    },
    put: {
      securityId: "p1",
      strike: 22400,
      optionType: "PUT",
      ltp: 1,
      oi: 1,
      previousOi: 1,
      deltaOi: 0,
      volume: 1,
      iv: 13,
      bid: 1,
      ask: 1,
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }
    }
  },
  {
    strike: 22500,
    call: {
      securityId: "c2",
      strike: 22500,
      optionType: "CALL",
      ltp: 1,
      oi: 1,
      previousOi: 1,
      deltaOi: 0,
      volume: 1,
      iv: 11,
      bid: 1,
      ask: 1,
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }
    },
    put: {
      securityId: "p2",
      strike: 22500,
      optionType: "PUT",
      ltp: 1,
      oi: 1,
      previousOi: 1,
      deltaOi: 0,
      volume: 1,
      iv: 12,
      bid: 1,
      ask: 1,
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }
    }
  }
];

describe("vol surface", () => {
  it("creates mesh from points", () => {
    const points = buildVolSurfacePoints(rows, [2, 5, 10]);
    const mesh = buildVolSurfaceMesh(points);

    expect(points.length).toBe(6);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  });
});