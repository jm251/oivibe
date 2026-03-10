"use client";

import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scanUnusualActivity, UoaEntry, UoaSentiment } from "@/lib/market/smart-analytics";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";

const SENTIMENT_CONFIG: Record<UoaSentiment, { color: string; icon: typeof TrendingUp }> = {
  bullish: { color: "text-bullish", icon: TrendingUp },
  bearish: { color: "text-bearish", icon: TrendingDown },
  neutral: { color: "text-muted-foreground", icon: AlertTriangle }
};

const INTENSITY_DOT: Record<string, string> = {
  high: "bg-warning animate-pulse",
  medium: "bg-bullish/70",
  low: "bg-muted-foreground/50"
};

function UoaRow({ entry }: { entry: UoaEntry }) {
  const config = SENTIMENT_CONFIG[entry.sentiment];
  const Icon = config.icon;

  return (
    <div className="grid grid-cols-[auto_50px_40px_1fr_1fr_1fr_1fr_auto] items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${INTENSITY_DOT[entry.intensity]}`} />
      <span className="font-mono font-semibold">{entry.strike}</span>
      <Badge
        variant={entry.optionType === "CALL" ? "bearish" : "bullish"}
        className="px-1 py-0 text-[9px]"
      >
        {entry.optionType === "CALL" ? "CE" : "PE"}
      </Badge>
      <div>
        <span className="text-[9px] text-muted-foreground">Vol</span>
        <p className="font-semibold">{entry.volume.toLocaleString("en-IN")}</p>
      </div>
      <div>
        <span className="text-[9px] text-muted-foreground">V/OI</span>
        <p className={`font-semibold ${entry.volumeOiRatio > 0.5 ? "text-warning" : ""}`}>
          {entry.volumeOiRatio.toFixed(2)}x
        </p>
      </div>
      <div>
        <span className="text-[9px] text-muted-foreground">dOI</span>
        <p className={entry.deltaOi >= 0 ? "text-bullish" : "text-bearish"}>
          {entry.deltaOi > 0 ? "+" : ""}{Math.round(entry.deltaOi).toLocaleString("en-IN")}
        </p>
      </div>
      <div>
        <span className="text-[9px] text-muted-foreground">Premium</span>
        <p className="font-semibold">
          {entry.premiumValue > 10000000
            ? `${(entry.premiumValue / 10000000).toFixed(1)}Cr`
            : entry.premiumValue > 100000
              ? `${(entry.premiumValue / 100000).toFixed(1)}L`
              : entry.premiumValue.toLocaleString("en-IN")}
        </p>
      </div>
      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
    </div>
  );
}

export function UoaPanel({
  rows,
  symbol
}: {
  rows: OptionChainRow[];
  symbol: SupportedSymbol;
}) {
  const entries = useMemo(() => scanUnusualActivity(rows, symbol), [rows, symbol]);

  const bullishCount = entries.filter((e) => e.sentiment === "bullish").length;
  const bearishCount = entries.filter((e) => e.sentiment === "bearish").length;
  const totalPremium = entries.reduce((s, e) => s + e.premiumValue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Unusual Activity Scanner
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="bullish">{bullishCount} Bull</Badge>
            <Badge variant="bearish">{bearishCount} Bear</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Signals</p>
            <p className="text-lg font-bold">{entries.length}</p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Net Flow</p>
            <p className={`text-lg font-bold ${bullishCount > bearishCount ? "text-bullish" : "text-bearish"}`}>
              {bullishCount > bearishCount ? "Bullish" : bearishCount > bullishCount ? "Bearish" : "Mixed"}
            </p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Premium</p>
            <p className="text-lg font-bold">
              {totalPremium > 10000000
                ? `${(totalPremium / 10000000).toFixed(1)}Cr`
                : `${(totalPremium / 100000).toFixed(1)}L`}
            </p>
          </div>
        </div>

        <ScrollArea className="h-[280px]">
          <div className="space-y-1">
            {entries.length > 0 ? (
              entries.map((entry) => <UoaRow key={entry.id} entry={entry} />)
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No unusual activity detected in current snapshot
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-warning animate-pulse" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-bullish/70" /> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50" /> Low
          </span>
          <span className="ml-auto">V/OI = Volume / Open Interest ratio</span>
        </div>
      </CardContent>
    </Card>
  );
}
