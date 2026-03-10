"use client";

import { Target } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeMaxPain } from "@/lib/market/advanced-analytics";
import { OptionChainRow } from "@/lib/types";

export function MaxPainPanel({ rows, spot }: { rows: OptionChainRow[]; spot: number }) {
  const maxPain = useMemo(() => computeMaxPain(rows, spot), [rows, spot]);

  if (!rows.length) return null;

  const topPains = [...maxPain.painByStrike]
    .sort((a, b) => a.totalPain - b.totalPain)
    .slice(0, 12);

  const maxTotal = Math.max(...topPains.map((p) => p.totalPain)) || 1;

  const diff = spot - maxPain.maxPainStrike;
  const diffPct = spot > 0 ? ((diff / spot) * 100).toFixed(2) : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-warning" />
            Max Pain
          </span>
          <Badge variant="warning">{maxPain.maxPainStrike.toLocaleString("en-IN")}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Pain</p>
            <p className="text-lg font-bold text-warning">
              {maxPain.maxPainStrike.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pin Zone</p>
            <p className="font-semibold">
              {maxPain.pinZoneLow.toLocaleString("en-IN")} - {maxPain.pinZoneHigh.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Spot vs Pain</p>
            <p className={`font-semibold ${diff > 0 ? "text-bullish" : diff < 0 ? "text-bearish" : "text-foreground"}`}>
              {diff > 0 ? "+" : ""}{diff.toFixed(0)} ({diffPct}%)
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Pain Distribution (Top Strikes)
          </p>
          {topPains.map((entry) => {
            const callPct = entry.totalPain > 0 ? (entry.callPain / entry.totalPain) * 100 : 50;
            const width = (entry.totalPain / maxTotal) * 100;
            const isMaxPain = entry.strike === maxPain.maxPainStrike;

            return (
              <div key={entry.strike} className="flex items-center gap-2 text-xs">
                <span className={`w-14 text-right font-mono ${isMaxPain ? "font-bold text-warning" : "text-muted-foreground"}`}>
                  {entry.strike}
                </span>
                <div className="flex-1">
                  <div
                    className={`flex h-4 overflow-hidden rounded ${isMaxPain ? "ring-1 ring-warning/50" : ""}`}
                    style={{ width: `${Math.max(8, width)}%` }}
                  >
                    <div
                      className="h-full bg-bearish/60"
                      style={{ width: `${callPct}%` }}
                    />
                    <div
                      className="h-full bg-bullish/60"
                      style={{ width: `${100 - callPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded bg-bearish/60" /> Call Pain
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded bg-bullish/60" /> Put Pain
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
