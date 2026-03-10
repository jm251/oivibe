"use client";

import { Building2, Users } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateFiiDiiData } from "@/lib/market/smart-analytics";

export function FiiDiiPanel({ spot }: { spot: number }) {
  const data = useMemo(() => generateFiiDiiData(spot), [spot]);

  if (!data.length) return null;

  const latest = data[data.length - 1]!;
  const previous = data.length > 1 ? data[data.length - 2]! : latest;
  const fiiChange = latest.fiiNetFutures - previous.fiiNetFutures;

  const maxFutures = Math.max(...data.map((d) => Math.abs(d.fiiNetFutures))) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            FII/DII Positioning
          </span>
          <Badge variant={latest.fiiSentiment === "bullish" ? "bullish" : latest.fiiSentiment === "bearish" ? "bearish" : "default"}>
            FII: {latest.fiiSentiment.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* FII Net Futures */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/80 bg-background/60 p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                FII Net Futures
              </span>
            </div>
            <p className={`mt-1 text-xl font-bold ${latest.fiiNetFutures >= 0 ? "text-bullish" : "text-bearish"}`}>
              {latest.fiiNetFutures > 0 ? "+" : ""}
              {(latest.fiiNetFutures / 1000).toFixed(1)}K
            </p>
            <p className={`text-xs ${fiiChange >= 0 ? "text-bullish" : "text-bearish"}`}>
              {fiiChange >= 0 ? "+" : ""}{(fiiChange / 1000).toFixed(1)}K vs prev
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/60 p-3">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                DII Net Futures
              </span>
            </div>
            <p className={`mt-1 text-xl font-bold ${latest.diiNetFutures >= 0 ? "text-bullish" : "text-bearish"}`}>
              {latest.diiNetFutures > 0 ? "+" : ""}
              {(latest.diiNetFutures / 1000).toFixed(1)}K
            </p>
            <p className="text-xs text-muted-foreground">
              Client: {(latest.clientNetFutures / 1000).toFixed(1)}K
            </p>
          </div>
        </div>

        {/* FII Net Futures 5-day bar chart */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            FII Index Futures (5-Day Trend)
          </p>
          <div className="rounded-md border border-border/80 bg-[#05080f] p-2">
            <svg viewBox="0 0 100 40" className="h-20 w-full">
              <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(201,211,230,0.15)" strokeWidth="0.3" />

              {data.map((d, i) => {
                const barW = 100 / data.length;
                const x = i * barW + barW * 0.15;
                const w = barW * 0.7;
                const h = Math.abs(d.fiiNetFutures / maxFutures) * 18;
                const y = d.fiiNetFutures >= 0 ? 20 - h : 20;
                const isPositive = d.fiiNetFutures >= 0;

                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={isPositive ? "rgba(0,255,126,0.5)" : "rgba(255,82,82,0.5)"}
                      rx="1"
                    />
                    <text
                      x={x + w / 2}
                      y="38"
                      textAnchor="middle"
                      fill="rgba(201,211,230,0.5)"
                      fontSize="2.5"
                    >
                      {d.date.slice(5)}
                    </text>
                    <text
                      x={x + w / 2}
                      y={d.fiiNetFutures >= 0 ? y - 1 : y + h + 3}
                      textAnchor="middle"
                      fill={isPositive ? "rgba(0,255,126,0.7)" : "rgba(255,82,82,0.7)"}
                      fontSize="2"
                    >
                      {(d.fiiNetFutures / 1000).toFixed(1)}K
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* FII Options OI */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          <div className="rounded border border-border/70 bg-background/50 p-1.5 text-center">
            <p className="text-[8px] uppercase text-muted-foreground">FII Call Long</p>
            <p className="font-semibold text-bullish">
              {(latest.fiiLongCallOi / 1000).toFixed(0)}K
            </p>
          </div>
          <div className="rounded border border-border/70 bg-background/50 p-1.5 text-center">
            <p className="text-[8px] uppercase text-muted-foreground">FII Call Short</p>
            <p className="font-semibold text-bearish">
              {(latest.fiiShortCallOi / 1000).toFixed(0)}K
            </p>
          </div>
          <div className="rounded border border-border/70 bg-background/50 p-1.5 text-center">
            <p className="text-[8px] uppercase text-muted-foreground">FII Put Long</p>
            <p className="font-semibold text-bullish">
              {(latest.fiiLongPutOi / 1000).toFixed(0)}K
            </p>
          </div>
          <div className="rounded border border-border/70 bg-background/50 p-1.5 text-center">
            <p className="text-[8px] uppercase text-muted-foreground">FII Put Short</p>
            <p className="font-semibold text-bearish">
              {(latest.fiiShortPutOi / 1000).toFixed(0)}K
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
