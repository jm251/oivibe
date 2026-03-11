import { ReplayFrameRecord } from "@/lib/replay/db";
import { getReplayDuckDb } from "@/lib/replay/duckdb";

export interface ReplaySessionAnalytics {
  frameCount: number;
  openSpot: number;
  closeSpot: number;
  lowSpot: number;
  highSpot: number;
  spotChange: number;
  avgPcrOi: number;
  peakPcrOi: number;
  peakCallOi: number;
  peakPutOi: number;
  degradedFrames: number;
  strongestBuildup: {
    strike: number;
    side: "CALL" | "PUT";
    deltaOi: number;
    updatedAt: string;
  } | null;
  strongestUnwinding: {
    strike: number;
    side: "CALL" | "PUT";
    deltaOi: number;
    updatedAt: string;
  } | null;
  busiestStrike: {
    strike: number;
    totalAbsDeltaOi: number;
    totalVolume: number;
    avgIv: number;
  } | null;
  persistentWall: {
    strike: number;
    side: "CALL" | "PUT";
    hits: number;
    peakOi: number;
  } | null;
  flowTotals: {
    callBuildup: number;
    putBuildup: number;
    callUnwinding: number;
    putUnwinding: number;
  };
}

interface ReplayAnalyticsFrameRow {
  session_date: string;
  updated_at: string;
  recorded_at: string;
  source_mode: "live" | "mock";
  degraded: boolean;
  spot: number;
  total_call_oi: number;
  total_put_oi: number;
  total_call_volume: number;
  total_put_volume: number;
  pcr_oi: number;
  pcr_volume: number;
}

interface ReplayAnalyticsContractRow {
  session_date: string;
  updated_at: string;
  strike: number;
  side: "CALL" | "PUT";
  security_id: string;
  oi: number;
  previous_oi: number;
  delta_oi: number;
  volume: number;
  ltp: number;
  iv: number;
  bid: number;
  ask: number;
}

export function buildReplayAnalyticsRows(frames: ReplayFrameRecord[]) {
  const frameRows: ReplayAnalyticsFrameRow[] = [];
  const contractRows: ReplayAnalyticsContractRow[] = [];

  for (const frame of frames) {
    frameRows.push({
      session_date: frame.sessionDate,
      updated_at: frame.updatedAt,
      recorded_at: frame.recordedAt,
      source_mode: frame.sourceMode,
      degraded: frame.degraded,
      spot: frame.spot,
      total_call_oi: frame.aggregates.totalCallOi,
      total_put_oi: frame.aggregates.totalPutOi,
      total_call_volume: frame.aggregates.totalCallVolume,
      total_put_volume: frame.aggregates.totalPutVolume,
      pcr_oi: frame.aggregates.pcrOi,
      pcr_volume: frame.aggregates.pcrVolume
    });

    for (const row of frame.rows) {
      contractRows.push({
        session_date: frame.sessionDate,
        updated_at: frame.updatedAt,
        strike: row.strike,
        side: "CALL",
        security_id: row.call.securityId,
        oi: row.call.oi,
        previous_oi: row.call.previousOi,
        delta_oi: row.call.deltaOi,
        volume: row.call.volume,
        ltp: row.call.ltp,
        iv: row.call.iv,
        bid: row.call.bid,
        ask: row.call.ask
      });

      contractRows.push({
        session_date: frame.sessionDate,
        updated_at: frame.updatedAt,
        strike: row.strike,
        side: "PUT",
        security_id: row.put.securityId,
        oi: row.put.oi,
        previous_oi: row.put.previousOi,
        delta_oi: row.put.deltaOi,
        volume: row.put.volume,
        ltp: row.put.ltp,
        iv: row.put.iv,
        bid: row.put.bid,
        ask: row.put.ask
      });
    }
  }

  return {
    frameRows,
    contractRows
  };
}

function buildTempName(prefix: string) {
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${token}`;
}

function readFirstRow<T>(rows: unknown[]): T | null {
  if (!rows.length) {
    return null;
  }

  return rows[0] as T;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function computeReplaySessionAnalytics(
  frames: ReplayFrameRecord[]
): Promise<ReplaySessionAnalytics | null> {
  if (!frames.length) {
    return null;
  }

  const db = await getReplayDuckDb();
  const conn = await db.connect();

  const frameTable = buildTempName("replay_frames");
  const contractTable = buildTempName("replay_contracts");
  const frameFile = `${frameTable}.json`;
  const contractFile = `${contractTable}.json`;
  const { frameRows, contractRows } = buildReplayAnalyticsRows(frames);

  try {
    await db.registerFileText(frameFile, JSON.stringify(frameRows));
    await db.registerFileText(contractFile, JSON.stringify(contractRows));

    await conn.insertJSONFromPath(frameFile, {
      schema: "main",
      name: frameTable
    });
    await conn.insertJSONFromPath(contractFile, {
      schema: "main",
      name: contractTable
    });

    const overview = readFirstRow<{
      frame_count: number;
      open_spot: number;
      close_spot: number;
      low_spot: number;
      high_spot: number;
      avg_pcr_oi: number;
      peak_pcr_oi: number;
      peak_call_oi: number;
      peak_put_oi: number;
      degraded_frames: number;
    }>(
      (
        await conn.query(`
          WITH ordered AS (
            SELECT *
            FROM ${frameTable}
            ORDER BY updated_at
          )
          SELECT
            COUNT(*) AS frame_count,
            (SELECT spot FROM ordered ORDER BY updated_at ASC LIMIT 1) AS open_spot,
            (SELECT spot FROM ordered ORDER BY updated_at DESC LIMIT 1) AS close_spot,
            MIN(spot) AS low_spot,
            MAX(spot) AS high_spot,
            AVG(pcr_oi) AS avg_pcr_oi,
            MAX(pcr_oi) AS peak_pcr_oi,
            MAX(total_call_oi) AS peak_call_oi,
            MAX(total_put_oi) AS peak_put_oi,
            SUM(CASE WHEN degraded THEN 1 ELSE 0 END) AS degraded_frames
          FROM ordered
        `)
      ).toArray()
    );

    const strongestBuildup = readFirstRow<{
      strike: number;
      side: "CALL" | "PUT";
      delta_oi: number;
      updated_at: string;
    }>(
      (
        await conn.query(`
          SELECT strike, side, delta_oi, updated_at
          FROM ${contractTable}
          ORDER BY delta_oi DESC, updated_at DESC
          LIMIT 1
        `)
      ).toArray()
    );

    const strongestUnwinding = readFirstRow<{
      strike: number;
      side: "CALL" | "PUT";
      delta_oi: number;
      updated_at: string;
    }>(
      (
        await conn.query(`
          SELECT strike, side, delta_oi, updated_at
          FROM ${contractTable}
          ORDER BY delta_oi ASC, updated_at DESC
          LIMIT 1
        `)
      ).toArray()
    );

    const busiestStrike = readFirstRow<{
      strike: number;
      total_abs_delta_oi: number;
      total_volume: number;
      avg_iv: number;
    }>(
      (
        await conn.query(`
          SELECT
            strike,
            SUM(ABS(delta_oi)) AS total_abs_delta_oi,
            SUM(volume) AS total_volume,
            AVG(iv) AS avg_iv
          FROM ${contractTable}
          GROUP BY strike
          ORDER BY total_abs_delta_oi DESC, total_volume DESC
          LIMIT 1
        `)
      ).toArray()
    );

    const persistentWall = readFirstRow<{
      strike: number;
      side: "CALL" | "PUT";
      hits: number;
      peak_oi: number;
    }>(
      (
        await conn.query(`
          WITH ranked AS (
            SELECT
              updated_at,
              strike,
              side,
              oi,
              ROW_NUMBER() OVER (
                PARTITION BY updated_at, side
                ORDER BY oi DESC
              ) AS oi_rank
            FROM ${contractTable}
          )
          SELECT
            strike,
            side,
            COUNT(*) AS hits,
            MAX(oi) AS peak_oi
          FROM ranked
          WHERE oi_rank <= 3
          GROUP BY strike, side
          ORDER BY hits DESC, peak_oi DESC
          LIMIT 1
        `)
      ).toArray()
    );

    const flowTotals = readFirstRow<{
      call_buildup: number;
      put_buildup: number;
      call_unwinding: number;
      put_unwinding: number;
    }>(
      (
        await conn.query(`
          SELECT
            SUM(CASE WHEN side = 'CALL' AND delta_oi > 0 THEN delta_oi ELSE 0 END) AS call_buildup,
            SUM(CASE WHEN side = 'PUT' AND delta_oi > 0 THEN delta_oi ELSE 0 END) AS put_buildup,
            SUM(CASE WHEN side = 'CALL' AND delta_oi < 0 THEN ABS(delta_oi) ELSE 0 END) AS call_unwinding,
            SUM(CASE WHEN side = 'PUT' AND delta_oi < 0 THEN ABS(delta_oi) ELSE 0 END) AS put_unwinding
          FROM ${contractTable}
        `)
      ).toArray()
    );

    return {
      frameCount: toNumber(overview?.frame_count),
      openSpot: toNumber(overview?.open_spot),
      closeSpot: toNumber(overview?.close_spot),
      lowSpot: toNumber(overview?.low_spot),
      highSpot: toNumber(overview?.high_spot),
      spotChange:
        toNumber(overview?.close_spot) - toNumber(overview?.open_spot),
      avgPcrOi: toNumber(overview?.avg_pcr_oi),
      peakPcrOi: toNumber(overview?.peak_pcr_oi),
      peakCallOi: toNumber(overview?.peak_call_oi),
      peakPutOi: toNumber(overview?.peak_put_oi),
      degradedFrames: toNumber(overview?.degraded_frames),
      strongestBuildup:
        strongestBuildup && toNullableNumber(strongestBuildup.strike) !== null
          ? {
              strike: toNumber(strongestBuildup.strike),
              side: strongestBuildup.side,
              deltaOi: toNumber(strongestBuildup.delta_oi),
              updatedAt: toStringValue(strongestBuildup.updated_at)
            }
          : null,
      strongestUnwinding:
        strongestUnwinding && toNullableNumber(strongestUnwinding.strike) !== null
          ? {
              strike: toNumber(strongestUnwinding.strike),
              side: strongestUnwinding.side,
              deltaOi: toNumber(strongestUnwinding.delta_oi),
              updatedAt: toStringValue(strongestUnwinding.updated_at)
            }
          : null,
      busiestStrike:
        busiestStrike && toNullableNumber(busiestStrike.strike) !== null
          ? {
              strike: toNumber(busiestStrike.strike),
              totalAbsDeltaOi: toNumber(busiestStrike.total_abs_delta_oi),
              totalVolume: toNumber(busiestStrike.total_volume),
              avgIv: toNumber(busiestStrike.avg_iv)
            }
          : null,
      persistentWall:
        persistentWall && toNullableNumber(persistentWall.strike) !== null
          ? {
              strike: toNumber(persistentWall.strike),
              side: persistentWall.side,
              hits: toNumber(persistentWall.hits),
              peakOi: toNumber(persistentWall.peak_oi)
            }
          : null,
      flowTotals: {
        callBuildup: toNumber(flowTotals?.call_buildup),
        putBuildup: toNumber(flowTotals?.put_buildup),
        callUnwinding: toNumber(flowTotals?.call_unwinding),
        putUnwinding: toNumber(flowTotals?.put_unwinding)
      }
    };
  } finally {
    await conn.query(`DROP TABLE IF EXISTS ${frameTable}`);
    await conn.query(`DROP TABLE IF EXISTS ${contractTable}`);
    await db.dropFiles([frameFile, contractFile]);
    await conn.close();
  }
}
