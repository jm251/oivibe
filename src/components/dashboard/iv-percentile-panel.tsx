"use client";

import { Gauge } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeIvPercentile } from "@/lib/market/frontier-analytics";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";

const REGIME_CONFIG = {
  "very-cheap": { color: "text-blue-400", bg: "bg-blue-400", label: "VERY CHEAP" },
  cheap: { color: "text-bullish", bg: "bg-bullish", label: "CHEAP" },
  normal: { color: "text-foreground", bg: "bg-foreground", label: "NORMAL" },
  rich: { color: "text-warning", bg: "bg-warning", label: "RICH" },
  "very-rich": { color: "text-bearish", bg: "bg-bearish", label: "VERY RICH" }
};

export function IvPercentilePanel({
  rows,
  spot,
  symbol
}: {
  rows: OptionChainRow[];
  spot: number;
  symbol: SupportedSymbol;
}) {
  const data = useMemo(() => computeIvPercentile(rows, spot, symbol), [rows, spot, symbol]);

  if (!data.currentIv) return null;

  const config = REGIME_CONFIG[data.regime];

  // Build IV history sparkline
  const ivValues = data.historicalIvs.map((h) => h.iv);
  const minIv = Math.min(...ivValues, data.currentIv) * 0.9;
  const maxIv = Math.max(...ivValues, data.currentIv) * 1.1;
  const ivRange = maxIv - minIv || 1;

  const sparkPoints = data.historicalIvs
    .map((h, i) => {
      const x = (i / (data.historicalIvs.length - 1 || 1)) * 100;
      const y = 100 - ((h.iv - minIv) / ivRange) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  // Gauge arc
  const gaugeAngle = (data.percentile / 100) * 180;
  const gaugeRad = (gaugeAngle * Math.PI) / 180;
  const cx = 50, cy = 50, r = 38;
  const endX = cx - r * Math.cos(gaugeRad);
  const endY = cy - r * Math.sin(gaugeRad);
  const largeArc = gaugeAngle > 90 ? 1 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-warning" />
            IV Percentile
          </span>
          <Badge variant={data.regime.includes("rich") ? "bearish" : data.regime.includes("cheap") ? "bullish" : "default"}>
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          {/* Gauge */}
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 55" className="h-full w-full">
              {/* Background arc */}
              <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none"
                stroke="rgba(201,211,230,0.1)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Color zones */}
              <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx - r * Math.cos(36 * Math.PI / 180)} ${cy - r * Math.sin(36 * Math.PI / 180)}`}
                fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="6" strokeLinecap="round"
              />
              <path
                d={`M ${cx - r * Math.cos(144 * Math.PI / 180)} ${cy - r * Math.sin(144 * Math.PI / 180)} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke="rgba(255,82,82,0.3)" strokeWidth="6" strokeLinecap="round"
              />
              {/* Value arc */}
              {data.percentile > 0 && (
                <path
                  d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
                  fill="none"
                  stroke={data.regime.includes("rich") ? "#ff5252" : data.regime.includes("cheap") ? "#00ff7e" : "#c9d3e6"}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              )}
              {/* Center text */}
              <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                {data.percentile}
              </text>
              <text x={cx} y={cy + 2} textAnchor="middle" fill="rgba(201,211,230,0.6)" fontSize="5">
                percentile
              </text>
            </svg>
          </div>

          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border/80 bg-background/60 p-1.5">
                <p className="text-[9px] uppercase text-muted-foreground">ATM IV</p>
                <p className="font-bold">{data.currentIv}%</p>
              </div>
              <div className="rounded-md border border-border/80 bg-background/60 p-1.5">
                <p className="text-[9px] uppercase text-muted-foreground">Regime</p>
                <p className={`font-bold ${config.color}`}>{config.label}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{data.suggestion}</p>
          </div>
        </div>

        {/* IV History sparkline */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            30-Day IV Trend
          </p>
          <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
            <svg viewBox="-2 0 104 30" className="h-16 w-full">
              {sparkPoints && (
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="rgba(100,140,220,0.6)"
                  strokeWidth="1"
                />
              )}
              {/* Current IV line */}
              <line
                x1="0"
                y1={100 - ((data.currentIv - minIv) / ivRange) * 100}
                x2="100"
                y2={100 - ((data.currentIv - minIv) / ivRange) * 100}
                stroke="rgba(255,200,50,0.4)"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
