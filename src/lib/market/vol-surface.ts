import { OptionChainRow, VolSurfacePoint } from "@/lib/types";
import { round } from "@/lib/utils";

export function buildVolSurfacePoints(rows: OptionChainRow[], dtes: number[] = [2, 5, 9, 14]): VolSurfacePoint[] {
  if (!rows.length) {
    return [];
  }

  const sortedRows = [...rows].sort((a, b) => a.strike - b.strike);
  const points: VolSurfacePoint[] = [];

  for (const row of sortedRows) {
    const baseIv = Math.max(6, (row.call.iv + row.put.iv) / 2);
    dtes.forEach((dte, index) => {
      const termShift = (dtes.length - index) * 0.22;
      points.push({
        strike: row.strike,
        dte,
        iv: round(Math.max(6, baseIv + termShift), 2)
      });
    });
  }

  return points;
}

export interface VolSurfaceMesh {
  vertices: number[];
  indices: number[];
}

export function buildVolSurfaceMesh(points: VolSurfacePoint[]): VolSurfaceMesh {
  if (!points.length) {
    return { vertices: [], indices: [] };
  }

  const strikes = Array.from(new Set(points.map((point) => point.strike))).sort((a, b) => a - b);
  const dtes = Array.from(new Set(points.map((point) => point.dte))).sort((a, b) => a - b);

  const pointMap = new Map<string, VolSurfacePoint>();
  points.forEach((point) => pointMap.set(`${point.strike}:${point.dte}`, point));

  const vertices: number[] = [];
  for (const dte of dtes) {
    for (const strike of strikes) {
      const point = pointMap.get(`${strike}:${dte}`) ?? { strike, dte, iv: 0 };
      vertices.push(strike, dte, point.iv);
    }
  }

  const indices: number[] = [];
  const width = strikes.length;
  for (let y = 0; y < dtes.length - 1; y += 1) {
    for (let x = 0; x < strikes.length - 1; x += 1) {
      const a = y * width + x;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return { vertices, indices };
}