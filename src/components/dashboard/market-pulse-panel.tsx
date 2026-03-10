"use client";

import { Brain, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMarketPulse } from "@/lib/market/frontier-analytics";
import { computeMaxPain } from "@/lib/market/advanced-analytics";
import { computeIvPercentile } from "@/lib/market/frontier-analytics";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";

const TREND_ICONS = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  sideways: Minus
};

export function MarketPulsePanel({
  rows,
  spot,
  symbol,
  pcrOi
}: {
  rows: OptionChainRow[];
  spot: number;
  symbol: SupportedSymbol;
  pcrOi: number;
}) {
  const pulse = useMemo(() => {
    if (!rows.length || spot <= 0) return null;
    const maxPain = computeMaxPain(rows, spot);
    const ivData = computeIvPercentile(rows, spot, symbol);
    return generateMarketPulse(rows, spot, symbol, pcrOi, maxPain.maxPainStrike, ivData.percentile);
  }, [rows, spot, symbol, pcrOi]);

  if (!pulse) return null;

  const TrendIcon = TREND_ICONS[pulse.trend];

  return (
    <Card className="border-bullish/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-bullish" />
            Market Pulse
          </span>
          <Badge variant={pulse.trend === "bullish" ? "bullish" : pulse.trend === "bearish" ? "bearish" : "default"}>
            <TrendIcon className="mr-1 h-3 w-3" />
            {pulse.trend.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="rounded-lg border border-bullish/20 bg-bullish/5 p-3">
          <p className="text-sm font-medium">{pulse.summary}</p>
        </div>

        {/* Key levels */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Support (Put Wall)</p>
            <p className="text-sm font-bold text-bullish">
              {pulse.keyLevels.support.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Resistance (Call Wall)</p>
            <p className="text-sm font-bold text-bearish">
              {pulse.keyLevels.resistance.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-2">
          {[
            { label: "PCR", text: pulse.pcrReading },
            { label: "Max Pain", text: pulse.maxPainNote },
            { label: "Volatility", text: pulse.volatilityNote },
            { label: "OI Signal", text: pulse.topSignal }
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-border/50 bg-background/30 px-3 py-2">
              <span className="mr-2 text-[9px] font-semibold uppercase tracking-wider text-bullish">
                {item.label}
              </span>
              <span className="text-xs text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>

        <p className="text-[9px] text-muted-foreground">
          Updated: {new Date(pulse.timestamp).toLocaleTimeString("en-IN")} | Auto-generated analysis
        </p>
      </CardContent>
    </Card>
  );
}
