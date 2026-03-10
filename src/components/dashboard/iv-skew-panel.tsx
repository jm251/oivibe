"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeIvSkew } from "@/lib/market/advanced-analytics";
import { OptionChainRow } from "@/lib/types";

const SKEW_LABELS = {
  left: { label: "Left Skew (Bearish Hedge)", variant: "bearish" as const },
  right: { label: "Right Skew (Call Demand)", variant: "bullish" as const },
  flat: { label: "Flat (Balanced)", variant: "default" as const }
};

export function IvSkewPanel({ rows, spot }: { rows: OptionChainRow[]; spot: number }) {
  const skew = useMemo(() => computeIvSkew(rows, spot), [rows, spot]);

  if (!skew.points.length) return null;

  const skewLabel = SKEW_LABELS[skew.skewDirection];

  // Build SVG polyline for call IV, put IV
  const xMin = skew.points[0]!.strike;
  const xMax = skew.points[skew.points.length - 1]!.strike;
  const xRange = xMax - xMin || 1;
  const yMin = skew.ivRange.min * 0.9;
  const yMax = skew.ivRange.max * 1.1;
  const yRange = yMax - yMin || 1;

  function toSvg(strike: number, iv: number): string {
    const x = ((strike - xMin) / xRange) * 100;
    const y = 100 - ((iv - yMin) / yRange) * 100;
    return `${x},${y}`;
  }

  const callLine = skew.points.filter((p) => p.callIv > 0).map((p) => toSvg(p.strike, p.callIv)).join(" ");
  const putLine = skew.points.filter((p) => p.putIv > 0).map((p) => toSvg(p.strike, p.putIv)).join(" ");

  // ATM line position
  const atmX = ((skew.atmStrike - xMin) / xRange) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>IV Skew / Volatility Smile</span>
          <Badge variant={skewLabel.variant}>{skewLabel.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">ATM IV</p>
            <p className="text-sm font-bold">{skew.atmIv}%</p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">IV Range</p>
            <p className="text-sm font-semibold">
              {skew.ivRange.min}% - {skew.ivRange.max}%
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">ATM Strike</p>
            <p className="text-sm font-semibold">{skew.atmStrike.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
          <svg viewBox="-2 -5 104 110" className="h-40 w-full">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="rgba(201,211,230,0.1)"
                strokeWidth="0.3"
              />
            ))}

            {/* ATM vertical line */}
            <line
              x1={atmX}
              y1="0"
              x2={atmX}
              y2="100"
              stroke="rgba(255,200,50,0.4)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <text x={atmX} y="-1" textAnchor="middle" fill="rgba(255,200,50,0.7)" fontSize="3">
              ATM
            </text>

            {/* Call IV line */}
            {callLine && (
              <polyline
                points={callLine}
                fill="none"
                stroke="#ff5252"
                strokeWidth="1.2"
                opacity="0.8"
              />
            )}

            {/* Put IV line */}
            {putLine && (
              <polyline
                points={putLine}
                fill="none"
                stroke="#00ff7e"
                strokeWidth="1.2"
                opacity="0.8"
              />
            )}

            {/* X-axis labels */}
            {skew.points
              .filter((_, i) => i % Math.max(1, Math.floor(skew.points.length / 6)) === 0)
              .map((p) => {
                const x = ((p.strike - xMin) / xRange) * 100;
                return (
                  <text
                    key={p.strike}
                    x={x}
                    y="108"
                    textAnchor="middle"
                    fill="rgba(201,211,230,0.5)"
                    fontSize="3"
                  >
                    {p.strike}
                  </text>
                );
              })}
          </svg>
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded bg-[#ff5252]" /> Call IV
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded bg-[#00ff7e]" /> Put IV
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded border-b border-dashed border-warning" /> ATM
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
