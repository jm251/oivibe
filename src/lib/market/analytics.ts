import { ChainAggregates, OiWall, OptionChainRow, TickDelta } from "@/lib/types";
import { percentile } from "@/lib/utils";

function toWalls(rows: OptionChainRow[], side: "CALL" | "PUT") {
  return rows
    .map((row) => {
      const leg = side === "CALL" ? row.call : row.put;
      return {
        strike: row.strike,
        oi: leg.oi,
        deltaOi: leg.deltaOi,
        side
      } satisfies OiWall;
    })
    .sort((a, b) => b.oi - a.oi)
    .slice(0, 5);
}

export function computeAggregates(rows: OptionChainRow[]): ChainAggregates {
  const totals = rows.reduce(
    (acc, row) => {
      acc.callOi += row.call.oi;
      acc.putOi += row.put.oi;
      acc.callVolume += row.call.volume;
      acc.putVolume += row.put.volume;

      const callBuildup: OiWall = {
        strike: row.strike,
        oi: row.call.oi,
        deltaOi: row.call.deltaOi,
        side: "CALL"
      };
      const putBuildup: OiWall = {
        strike: row.strike,
        oi: row.put.oi,
        deltaOi: row.put.deltaOi,
        side: "PUT"
      };

      acc.buildups.push(callBuildup, putBuildup);
      return acc;
    },
    {
      callOi: 0,
      putOi: 0,
      callVolume: 0,
      putVolume: 0,
      buildups: [] as OiWall[]
    }
  );

  const sortedByDelta = totals.buildups
    .filter((entry) => Number.isFinite(entry.deltaOi))
    .sort((a, b) => b.deltaOi - a.deltaOi);

  const strongestBuildup = sortedByDelta[0] ?? null;
  const strongestUnwinding = [...sortedByDelta].reverse()[0] ?? null;

  return {
    totalCallOi: totals.callOi,
    totalPutOi: totals.putOi,
    totalCallVolume: totals.callVolume,
    totalPutVolume: totals.putVolume,
    pcrOi: totals.callOi > 0 ? totals.putOi / totals.callOi : 0,
    pcrVolume: totals.callVolume > 0 ? totals.putVolume / totals.callVolume : 0,
    topCallWalls: toWalls(rows, "CALL"),
    topPutWalls: toWalls(rows, "PUT"),
    strongestBuildup,
    strongestUnwinding
  };
}

export function buildHeatIntensity(rows: OptionChainRow[]) {
  const deltas = rows.flatMap((row) => [Math.abs(row.call.deltaOi), Math.abs(row.put.deltaOi)]);
  const threshold = percentile(deltas, 0.8) || 1;

  return rows.map((row) => ({
    strike: row.strike,
    callIntensity: Math.min(1, Math.abs(row.call.deltaOi) / threshold),
    putIntensity: Math.min(1, Math.abs(row.put.deltaOi) / threshold)
  }));
}

export function applyTickUpdates(
  rows: OptionChainRow[],
  updates: TickDelta[]
): OptionChainRow[] {
  if (!updates.length) {
    return rows;
  }

  const map = new Map<string, TickDelta>(updates.map((update) => [update.securityId, update]));

  return rows.map((row) => {
    const callTick = map.get(row.call.securityId);
    const putTick = map.get(row.put.securityId);

    const call = callTick
      ? {
          ...row.call,
          ltp: callTick.ltp,
          volume: callTick.volume,
          previousOi: row.call.oi,
          oi: callTick.oi,
          deltaOi: callTick.deltaOi,
          bid: callTick.bid ?? row.call.bid,
          ask: callTick.ask ?? row.call.ask,
          iv: callTick.iv ?? row.call.iv,
          greeks: {
            delta: callTick.greeks?.delta ?? row.call.greeks.delta,
            gamma: callTick.greeks?.gamma ?? row.call.greeks.gamma,
            theta: callTick.greeks?.theta ?? row.call.greeks.theta,
            vega: callTick.greeks?.vega ?? row.call.greeks.vega
          }
        }
      : row.call;

    const put = putTick
      ? {
          ...row.put,
          ltp: putTick.ltp,
          volume: putTick.volume,
          previousOi: row.put.oi,
          oi: putTick.oi,
          deltaOi: putTick.deltaOi,
          bid: putTick.bid ?? row.put.bid,
          ask: putTick.ask ?? row.put.ask,
          iv: putTick.iv ?? row.put.iv,
          greeks: {
            delta: putTick.greeks?.delta ?? row.put.greeks.delta,
            gamma: putTick.greeks?.gamma ?? row.put.greeks.gamma,
            theta: putTick.greeks?.theta ?? row.put.greeks.theta,
            vega: putTick.greeks?.vega ?? row.put.greeks.vega
          }
        }
      : row.put;

    return { ...row, call, put };
  });
}
