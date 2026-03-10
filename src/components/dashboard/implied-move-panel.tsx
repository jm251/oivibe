"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateImpliedVsActualHistory } from "@/lib/market/frontier-analytics";
import { SupportedSymbol } from "@/lib/types";

export function ImpliedMovePanel({
  spot,
  symbol
}: {
  spot: number;
  symbol: SupportedSymbol;
}) {
  const history = useMemo(
    () => generateImpliedVsActualHistory(spot, symbol),
    [spot, symbol]
  );

  if (!history.length) return null;

  const latest = history[history.length - 1]!;
  const avgAccuracy = Math.round(history.reduce((s, e) => s + e.accuracy, 0) / history.length);
  const overCount = history.filter((e) => e.overUnder === "over").length;
  const underCount = history.filter((e) => e.overUnder === "under").length;

  const maxMove = Math.max(...history.flatMap((e) => [e.impliedMove, e.actualMove])) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Implied vs Actual Move</span>
          <Badge variant={avgAccuracy > 60 ? "bullish" : "warning"}>
            Avg Accuracy: {avgAccuracy}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Today Implied</p>
            <p className="text-sm font-bold">{latest.impliedMove.toFixed(0)} pts</p>
            <p className="text-muted-foreground">{latest.impliedMovePct}%</p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Last Actual</p>
            <p className={`text-sm font-bold ${latest.overUnder === "over" ? "text-bearish" : "text-bullish"}`}>
              {latest.actualMove.toFixed(0)} pts
            </p>
            <p className="text-muted-foreground">{latest.actualMovePct}%</p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Exceeded</p>
            <p className="text-sm font-bold text-bearish">{overCount}x</p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Fell Short</p>
            <p className="text-sm font-bold text-bullish">{underCount}x</p>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
          <svg viewBox="0 0 100 45" className="h-28 w-full">
            {/* Bars */}
            {history.map((entry, i) => {
              const barW = 100 / history.length;
              const x = i * barW;
              const halfW = barW * 0.35;
              const impliedH = (entry.impliedMove / maxMove) * 38;
              const actualH = (entry.actualMove / maxMove) * 38;

              return (
                <g key={entry.date}>
                  {/* Implied bar */}
                  <rect
                    x={x + barW * 0.1}
                    y={40 - impliedH}
                    width={halfW}
                    height={impliedH}
                    fill="rgba(100,140,220,0.5)"
                    rx="0.5"
                  />
                  {/* Actual bar */}
                  <rect
                    x={x + barW * 0.1 + halfW + 1}
                    y={40 - actualH}
                    width={halfW}
                    height={actualH}
                    fill={entry.overUnder === "over" ? "rgba(255,82,82,0.6)" : "rgba(0,255,126,0.6)"}
                    rx="0.5"
                  />
                  {/* Date label */}
                  <text
                    x={x + barW / 2}
                    y="44"
                    textAnchor="middle"
                    fill="rgba(201,211,230,0.4)"
                    fontSize="2"
                  >
                    {entry.date.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[rgba(100,140,220,0.5)]" /> Implied
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[rgba(0,255,126,0.6)]" /> Actual (Under)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[rgba(255,82,82,0.6)]" /> Actual (Over)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
