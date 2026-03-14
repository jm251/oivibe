"use client";

import { ArrowBigDownDash, ArrowBigUpDash } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildHeatIntensity } from "@/lib/market/analytics";
import { OptionChainRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OiHeatmapPanel({ rows }: { rows: OptionChainRow[] }) {
  const intensities = buildHeatIntensity(rows).slice(-20);

  return (
    <Card className="trading-grid">
      <CardHeader>
        <CardTitle>OI Wall Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-xs text-muted-foreground">
          <span>Strike</span>
          <span>Call Delta OI</span>
          <span>Put Delta OI</span>
        </div>
        <div className="mt-3 space-y-1">
          {intensities.map((item) => {
            const row = rows.find((entry) => entry.strike === item.strike);
            if (!row) return null;

            return (
              <div
                key={item.strike}
                className="grid grid-cols-[80px_1fr_1fr] items-center gap-2 text-xs"
              >
                <span className="font-semibold text-foreground">{item.strike}</span>
                <div
                  className={cn(
                    "h-6 rounded px-2 text-right leading-6",
                    row.call.deltaOi >= 0
                      ? "bg-bullish/20 text-bullish"
                      : "bg-bearish/20 text-bearish"
                  )}
                  style={{ opacity: 0.22 + item.callIntensity * 0.78 }}
                >
                  <span className="inline-flex items-center gap-1">
                    {row.call.deltaOi >= 0 ? (
                      <ArrowBigUpDash className="h-3 w-3" />
                    ) : (
                      <ArrowBigDownDash className="h-3 w-3" />
                    )}
                    {Math.round(row.call.deltaOi).toLocaleString("en-IN")}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-6 rounded px-2 text-right leading-6",
                    row.put.deltaOi >= 0
                      ? "bg-bullish/20 text-bullish"
                      : "bg-bearish/20 text-bearish"
                  )}
                  style={{ opacity: 0.22 + item.putIntensity * 0.78 }}
                >
                  <span className="inline-flex items-center gap-1">
                    {row.put.deltaOi >= 0 ? (
                      <ArrowBigUpDash className="h-3 w-3" />
                    ) : (
                      <ArrowBigDownDash className="h-3 w-3" />
                    )}
                    {Math.round(row.put.deltaOi).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
