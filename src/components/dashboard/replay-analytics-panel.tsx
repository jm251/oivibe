"use client";

import { format } from "date-fns";
import { DatabaseZap, TrendingDown, TrendingUp } from "lucide-react";

import { useReplayAnalytics } from "@/hooks/use-replay-analytics";
import { ReplayFrameRecord } from "@/lib/replay/db";

interface ReplayAnalyticsPanelProps {
  frames: ReplayFrameRecord[] | undefined;
  sessionDate: string;
}

function formatMarketNumber(value: number, digits = 2) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits
  });
}

function formatSignedMarketNumber(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMarketNumber(value, digits)}`;
}

export function ReplayAnalyticsPanel({
  frames,
  sessionDate
}: ReplayAnalyticsPanelProps) {
  const analyticsQuery = useReplayAnalytics(frames, sessionDate);
  const analytics = analyticsQuery.data;

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-background/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Local Session SQL</p>
          <p className="text-xs text-muted-foreground">
            DuckDB-Wasm scans cached session frames directly in the browser.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <DatabaseZap className="h-3.5 w-3.5" />
          DuckDB-Wasm
        </span>
      </div>

      {analyticsQuery.isLoading ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
          Running local SQL over {frames?.length ?? 0} cached frames for {sessionDate}.
        </div>
      ) : null}

      {analyticsQuery.error ? (
        <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {analyticsQuery.error instanceof Error
            ? analyticsQuery.error.message
            : "Replay analytics failed."}
        </div>
      ) : null}

      {analytics ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Open to Close
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatMarketNumber(analytics.openSpot)} to{" "}
                {formatMarketNumber(analytics.closeSpot)}
              </p>
              <p
                className={`mt-1 text-xs ${
                  analytics.spotChange >= 0 ? "text-bullish" : "text-bearish"
                }`}
              >
                {formatSignedMarketNumber(analytics.spotChange)}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Session Range
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatMarketNumber(analytics.lowSpot)} -{" "}
                {formatMarketNumber(analytics.highSpot)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatSignedMarketNumber(analytics.highSpot - analytics.lowSpot)}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                PCR Regime
              </p>
              <p className="mt-2 text-sm font-semibold">
                Avg {formatMarketNumber(analytics.avgPcrOi, 3)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Peak {formatMarketNumber(analytics.peakPcrOi, 3)}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                OI Peaks
              </p>
              <p className="mt-2 text-sm font-semibold">
                CE {formatMarketNumber(analytics.peakCallOi, 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PE {formatMarketNumber(analytics.peakPutOi, 0)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-bullish" />
                Session Flow
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p>
                  Call buildup:{" "}
                  <span className="text-foreground">
                    {formatMarketNumber(analytics.flowTotals.callBuildup, 0)}
                  </span>
                </p>
                <p>
                  Put buildup:{" "}
                  <span className="text-foreground">
                    {formatMarketNumber(analytics.flowTotals.putBuildup, 0)}
                  </span>
                </p>
                <p>
                  Call unwinding:{" "}
                  <span className="text-foreground">
                    {formatMarketNumber(analytics.flowTotals.callUnwinding, 0)}
                  </span>
                </p>
                <p>
                  Put unwinding:{" "}
                  <span className="text-foreground">
                    {formatMarketNumber(analytics.flowTotals.putUnwinding, 0)}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                Dominant Structure
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <p>
                  Busiest strike:{" "}
                  <span className="text-foreground">
                    {analytics.busiestStrike
                      ? `${formatMarketNumber(analytics.busiestStrike.strike, 0)} | abs dOI ${formatMarketNumber(
                          analytics.busiestStrike.totalAbsDeltaOi,
                          0
                        )}`
                      : "-"}
                  </span>
                </p>
                <p>
                  Persistent wall:{" "}
                  <span className="text-foreground">
                    {analytics.persistentWall
                      ? `${formatMarketNumber(analytics.persistentWall.strike, 0)} ${analytics.persistentWall.side} | ${analytics.persistentWall.hits} hits`
                      : "-"}
                  </span>
                </p>
                <p>
                  Degraded frames:{" "}
                  <span className="text-foreground">{analytics.degradedFrames}</span>
                </p>
                <p>
                  Session frames:{" "}
                  <span className="text-foreground">{analytics.frameCount}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <p className="text-sm font-medium">Strongest Buildup</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {analytics.strongestBuildup
                  ? `${formatMarketNumber(analytics.strongestBuildup.strike, 0)} ${analytics.strongestBuildup.side} | dOI ${formatMarketNumber(
                      analytics.strongestBuildup.deltaOi,
                      0
                    )} | ${format(new Date(analytics.strongestBuildup.updatedAt), "HH:mm:ss")}`
                  : "-"}
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-background/50 p-3">
              <p className="text-sm font-medium">Strongest Unwinding</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {analytics.strongestUnwinding
                  ? `${formatMarketNumber(analytics.strongestUnwinding.strike, 0)} ${analytics.strongestUnwinding.side} | dOI ${formatSignedMarketNumber(
                      analytics.strongestUnwinding.deltaOi,
                      0
                    )} | ${format(new Date(analytics.strongestUnwinding.updatedAt), "HH:mm:ss")}`
                  : "-"}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
