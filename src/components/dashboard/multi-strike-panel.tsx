"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMultiStrikeData } from "@/lib/market/smart-analytics";
import { OptionChainRow } from "@/lib/types";

export function MultiStrikePanel({
  rows,
  spot
}: {
  rows: OptionChainRow[];
  spot: number;
}) {
  const data = useMemo(() => getMultiStrikeData(rows, spot, 12), [rows, spot]);

  if (!data.length) return null;

  const maxOi = Math.max(...data.flatMap((d) => [d.callOi, d.putOi])) || 1;
  const maxDeltaOi = Math.max(...data.flatMap((d) => [Math.abs(d.callDeltaOi), Math.abs(d.putDeltaOi)])) || 1;

  // Build SVG for OI comparison
  const barWidth = 100 / data.length;
  const barGap = barWidth * 0.1;
  const halfBar = (barWidth - barGap * 2) / 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Strike OI Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OI Bars */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Open Interest by Strike
          </p>
          <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
            <svg viewBox="0 0 100 50" className="h-32 w-full">
              {data.map((d, i) => {
                const x = i * barWidth + barGap;
                const callH = (d.callOi / maxOi) * 45;
                const putH = (d.putOi / maxOi) * 45;
                const isAtm = Math.abs(d.strike - spot) === Math.min(...data.map((dd) => Math.abs(dd.strike - spot)));

                return (
                  <g key={d.strike}>
                    {/* Call OI bar */}
                    <rect
                      x={x}
                      y={45 - callH}
                      width={halfBar}
                      height={callH}
                      fill="rgba(255,82,82,0.6)"
                      rx="0.5"
                    />
                    {/* Put OI bar */}
                    <rect
                      x={x + halfBar}
                      y={45 - putH}
                      width={halfBar}
                      height={putH}
                      fill="rgba(0,255,126,0.6)"
                      rx="0.5"
                    />
                    {/* Strike label */}
                    <text
                      x={x + halfBar}
                      y="49.5"
                      textAnchor="middle"
                      fill={isAtm ? "rgba(255,200,50,0.9)" : "rgba(201,211,230,0.4)"}
                      fontSize="2.2"
                      fontWeight={isAtm ? "bold" : "normal"}
                    >
                      {d.strike}
                    </text>
                    {/* ATM marker */}
                    {isAtm && (
                      <line
                        x1={x + halfBar}
                        y1="0"
                        x2={x + halfBar}
                        y2="45"
                        stroke="rgba(255,200,50,0.3)"
                        strokeWidth="0.3"
                        strokeDasharray="1,1"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Delta OI Bars (bidirectional) */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Change in OI (Delta OI)
          </p>
          <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
            <svg viewBox="0 0 100 50" className="h-28 w-full">
              {/* Center line */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(201,211,230,0.15)" strokeWidth="0.3" />

              {data.map((d, i) => {
                const x = i * barWidth + barGap;
                const callDeltaH = (d.callDeltaOi / maxDeltaOi) * 22;
                const putDeltaH = (d.putDeltaOi / maxDeltaOi) * 22;

                return (
                  <g key={d.strike}>
                    {/* Call delta OI */}
                    <rect
                      x={x}
                      y={callDeltaH >= 0 ? 25 - callDeltaH : 25}
                      width={halfBar}
                      height={Math.abs(callDeltaH)}
                      fill={callDeltaH >= 0 ? "rgba(255,82,82,0.5)" : "rgba(255,82,82,0.3)"}
                      rx="0.3"
                    />
                    {/* Put delta OI */}
                    <rect
                      x={x + halfBar}
                      y={putDeltaH >= 0 ? 25 - putDeltaH : 25}
                      width={halfBar}
                      height={Math.abs(putDeltaH)}
                      fill={putDeltaH >= 0 ? "rgba(0,255,126,0.5)" : "rgba(0,255,126,0.3)"}
                      rx="0.3"
                    />
                    {/* Strike label */}
                    <text
                      x={x + halfBar}
                      y="49"
                      textAnchor="middle"
                      fill="rgba(201,211,230,0.4)"
                      fontSize="2.2"
                    >
                      {d.strike}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[rgba(255,82,82,0.6)]" /> Call OI
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[rgba(0,255,126,0.6)]" /> Put OI
          </span>
          <span className="text-warning">ATM highlighted</span>
        </div>
      </CardContent>
    </Card>
  );
}
