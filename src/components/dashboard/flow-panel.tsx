"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChainAggregates } from "@/lib/types";

function flowPercent(call: number, put: number) {
  const total = call + put;
  if (total <= 0) return { callPct: 50, putPct: 50 };
  return {
    callPct: (call / total) * 100,
    putPct: (put / total) * 100
  };
}

export function FlowPanel({ aggregates }: { aggregates: ChainAggregates }) {
  const oiFlow = flowPercent(aggregates.totalCallOi, aggregates.totalPutOi);
  const volFlow = flowPercent(aggregates.totalCallVolume, aggregates.totalPutVolume);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Call vs Put Flow</span>
          <Badge variant={aggregates.pcrOi > 1 ? "bullish" : "bearish"}>
            PCR(OI): {aggregates.pcrOi.toFixed(2)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Open Interest Flow</span>
            <span>
              CE {oiFlow.callPct.toFixed(1)}% / PE {oiFlow.putPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-bearish" style={{ width: `${oiFlow.callPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-bearish">
              Calls {aggregates.totalCallOi.toLocaleString("en-IN")}
            </span>
            <span className="text-bullish">
              Puts {aggregates.totalPutOi.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Volume Flow</span>
            <span>
              CE {volFlow.callPct.toFixed(1)}% / PE {volFlow.putPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-bullish" style={{ width: `${volFlow.putPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-bearish">
              <TrendingDown className="h-3 w-3" />
              CE {aggregates.totalCallVolume.toLocaleString("en-IN")}
            </span>
            <span className="inline-flex items-center gap-1 text-bullish">
              <TrendingUp className="h-3 w-3" />
              PE {aggregates.totalPutVolume.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/70 p-2">
            <p className="text-muted-foreground">Top Call Wall</p>
            <p className="mt-1 text-bearish">
              {aggregates.topCallWalls[0]?.strike ?? "-"} (
              {aggregates.topCallWalls[0]?.oi.toLocaleString("en-IN") ?? "-"})
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/70 p-2">
            <p className="text-muted-foreground">Top Put Wall</p>
            <p className="mt-1 text-bullish">
              {aggregates.topPutWalls[0]?.strike ?? "-"} (
              {aggregates.topPutWalls[0]?.oi.toLocaleString("en-IN") ?? "-"})
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}