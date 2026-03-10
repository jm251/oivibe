"use client";

import { Zap } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { computeGexProfile } from "@/lib/market/advanced-analytics";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";

export function GexPanel({
  rows,
  spot,
  symbol
}: {
  rows: OptionChainRow[];
  spot: number;
  symbol: SupportedSymbol;
}) {
  const gex = useMemo(() => computeGexProfile(rows, spot, symbol), [rows, spot, symbol]);

  if (!gex.entries.length) return null;

  const maxAbsGex = Math.max(...gex.entries.map((e) => Math.abs(e.netGex))) || 1;

  // Only show strikes near ATM (±10 strikes)
  const atmIdx = gex.entries.findIndex(
    (e) => Math.abs(e.strike - spot) === Math.min(...gex.entries.map((en) => Math.abs(en.strike - spot)))
  );
  const displayEntries = gex.entries.slice(
    Math.max(0, atmIdx - 10),
    Math.min(gex.entries.length, atmIdx + 11)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            Gamma Exposure (GEX)
          </span>
          <Badge variant={gex.isPositiveGamma ? "bullish" : "bearish"}>
            {gex.isPositiveGamma ? "+GEX (Range)" : "-GEX (Trend)"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Net GEX</p>
            <p className={`text-sm font-bold ${gex.totalNetGex >= 0 ? "text-bullish" : "text-bearish"}`}>
              {(gex.totalNetGex / 1_000_000).toFixed(1)}M
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Gamma Flip</p>
            <p className="text-sm font-bold text-warning">
              {gex.gammaFlipStrike?.toLocaleString("en-IN") ?? "N/A"}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Regime</p>
            <p className={`text-sm font-bold ${gex.isPositiveGamma ? "text-bullish" : "text-bearish"}`}>
              {gex.isPositiveGamma ? "Stabilizing" : "Amplifying"}
            </p>
          </div>
        </div>

        <ScrollArea className="h-[220px]">
          <div className="space-y-0.5">
            {displayEntries.map((entry) => {
              const barWidth = Math.abs(entry.netGex) / maxAbsGex;
              const isFlip = entry.strike === gex.gammaFlipStrike;
              const isAtm = Math.abs(entry.strike - spot) === Math.min(...displayEntries.map((e) => Math.abs(e.strike - spot)));

              return (
                <div
                  key={entry.strike}
                  className={`flex items-center gap-2 rounded px-1 py-0.5 text-xs ${isFlip ? "bg-warning/10 ring-1 ring-warning/30" : ""}`}
                >
                  <span className={`w-14 text-right font-mono ${isAtm ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                    {entry.strike}
                  </span>

                  {/* Negative GEX bar (left) */}
                  <div className="flex w-20 justify-end">
                    {entry.netGex < 0 && (
                      <div
                        className="h-3.5 rounded-l bg-bearish/50"
                        style={{ width: `${barWidth * 100}%` }}
                      />
                    )}
                  </div>

                  <div className="w-px self-stretch bg-border" />

                  {/* Positive GEX bar (right) */}
                  <div className="flex w-20">
                    {entry.netGex >= 0 && (
                      <div
                        className="h-3.5 rounded-r bg-bullish/50"
                        style={{ width: `${barWidth * 100}%` }}
                      />
                    )}
                  </div>

                  <span className={`w-16 text-right font-mono text-[10px] ${entry.netGex >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {(entry.netGex / 1000).toFixed(0)}K
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <p className="text-[10px] text-muted-foreground">
          {gex.isPositiveGamma
            ? "Positive GEX: Dealers hedge by selling rallies & buying dips (range-bound)."
            : "Negative GEX: Dealers amplify moves (trending/volatile market)."}
        </p>
      </CardContent>
    </Card>
  );
}
