"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computePnlHeatmap, PnlHeatmapData } from "@/lib/market/smart-analytics";
import { useMarketStore } from "@/store/market-store";
import { useStrategyStore } from "@/store/strategy-store";

function pnlColor(pnl: number, maxProfit: number, maxLoss: number): string {
  if (pnl === 0) return "rgba(201,211,230,0.1)";

  if (pnl > 0) {
    const intensity = Math.min(1, pnl / (maxProfit || 1));
    const g = Math.round(80 + intensity * 175);
    return `rgba(0,${g},50,${0.15 + intensity * 0.7})`;
  }

  const intensity = Math.min(1, Math.abs(pnl) / (Math.abs(maxLoss) || 1));
  const r = Math.round(80 + intensity * 175);
  return `rgba(${r},20,20,${0.15 + intensity * 0.7})`;
}

export function PnlHeatmapPanel() {
  const spot = useMarketStore((s) => s.spot);
  const symbol = useMarketStore((s) => s.symbol);
  const { legs, quantity } = useStrategyStore();

  const lotSize = symbol === "BANKNIFTY" ? 15 : symbol === "FINNIFTY" ? 25 : 50;

  const heatmap: PnlHeatmapData = useMemo(() => {
    if (!legs.length || spot <= 0) {
      return { cells: [], spotRange: [], dteRange: [], maxProfit: 0, maxLoss: 0 };
    }

    return computePnlHeatmap(
      legs.map((l) => ({
        ...l,
        quantity,
        lotSize
      })),
      spot
    );
  }, [legs, spot, quantity, lotSize]);

  if (!heatmap.cells.length || !legs.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P&L Heatmap (Spot x Time)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Add strategy legs in Strategy Lab to see the P&L heatmap
          </div>
        </CardContent>
      </Card>
    );
  }

  const cellW = 100 / heatmap.spotRange.length;
  const cellH = 100 / heatmap.dteRange.length;

  // Spot position marker
  const spotIdx = heatmap.spotRange.reduce(
    (bestIdx, s, idx) =>
      Math.abs(s - spot) < Math.abs(heatmap.spotRange[bestIdx]! - spot) ? idx : bestIdx,
    0
  );
  const spotX = (spotIdx + 0.5) * cellW;

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L Heatmap (Spot x Time)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
          <svg viewBox="0 0 110 70" className="h-52 w-full">
            {/* Y-axis label */}
            <text x="-2" y="35" textAnchor="middle" fill="rgba(201,211,230,0.5)" fontSize="2.5" transform="rotate(-90,-2,35)">
              DTE
            </text>

            {/* Cells */}
            {heatmap.cells.map((cell) => {
              const xIdx = heatmap.spotRange.indexOf(cell.spot);
              const yIdx = heatmap.dteRange.indexOf(cell.dte);
              if (xIdx === -1 || yIdx === -1) return null;

              const x = 5 + xIdx * (100 / heatmap.spotRange.length);
              const y = 3 + yIdx * (55 / heatmap.dteRange.length);
              const w = 100 / heatmap.spotRange.length;
              const h = 55 / heatmap.dteRange.length;

              return (
                <rect
                  key={`${cell.spot}-${cell.dte}`}
                  x={x}
                  y={y}
                  width={w - 0.2}
                  height={h - 0.2}
                  fill={pnlColor(cell.pnl, heatmap.maxProfit, heatmap.maxLoss)}
                  rx="0.3"
                >
                  <title>{`Spot: ${cell.spot} | DTE: ${cell.dte} | P&L: ${cell.pnl.toLocaleString("en-IN")}`}</title>
                </rect>
              );
            })}

            {/* Current spot marker */}
            <line
              x1={5 + spotX * (100 / heatmap.spotRange.length) / cellW}
              y1="1"
              x2={5 + spotX * (100 / heatmap.spotRange.length) / cellW}
              y2="58"
              stroke="rgba(255,200,50,0.5)"
              strokeWidth="0.4"
              strokeDasharray="1,1"
            />

            {/* X-axis labels (spot prices) */}
            {heatmap.spotRange
              .filter((_, i) => i % Math.max(1, Math.floor(heatmap.spotRange.length / 8)) === 0)
              .map((s) => {
                const idx = heatmap.spotRange.indexOf(s);
                const x = 5 + (idx + 0.5) * (100 / heatmap.spotRange.length);
                return (
                  <text key={s} x={x} y="63" textAnchor="middle" fill="rgba(201,211,230,0.5)" fontSize="2.2">
                    {s}
                  </text>
                );
              })}

            {/* Y-axis labels (DTE) */}
            {heatmap.dteRange.map((dte, i) => {
              const y = 3 + (i + 0.5) * (55 / heatmap.dteRange.length);
              return (
                <text key={dte} x="3" y={y + 1} textAnchor="end" fill="rgba(201,211,230,0.5)" fontSize="2.2">
                  {dte}d
                </text>
              );
            })}

            {/* X-axis title */}
            <text x="55" y="68" textAnchor="middle" fill="rgba(201,211,230,0.5)" fontSize="2.5">
              Spot Price
            </text>
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded bg-gradient-to-r from-[rgba(200,20,20,0.8)] via-[rgba(201,211,230,0.1)] to-[rgba(0,200,50,0.8)]" />
            Loss to Profit
          </span>
          <span>
            Max Profit: <span className="text-bullish">{heatmap.maxProfit.toLocaleString("en-IN")}</span>
            {" | "}
            Max Loss: <span className="text-bearish">{heatmap.maxLoss.toLocaleString("en-IN")}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
