"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BuildupType, classifyOiBuildups } from "@/lib/market/advanced-analytics";
import { OptionChainRow } from "@/lib/types";

const BUILDUP_LABELS: Record<BuildupType, { label: string; color: string; short: string }> = {
  "long-buildup": { label: "Long Buildup", color: "bg-bullish/20 text-bullish", short: "LB" },
  "short-buildup": { label: "Short Buildup", color: "bg-bearish/20 text-bearish", short: "SB" },
  "long-unwinding": { label: "Long Unwinding", color: "bg-warning/20 text-warning", short: "LU" },
  "short-covering": { label: "Short Covering", color: "bg-blue-500/20 text-blue-400", short: "SC" },
  neutral: { label: "Neutral", color: "bg-muted text-muted-foreground", short: "--" }
};

function BuildupBadge({ type }: { type: BuildupType }) {
  const info = BUILDUP_LABELS[type];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${info.color}`}>
      {info.short}
    </span>
  );
}

export function BuildupPanel({ rows }: { rows: OptionChainRow[] }) {
  const classifications = useMemo(() => classifyOiBuildups(rows), [rows]);

  const activeClassifications = classifications.filter(
    (c) => c.callBuildup !== "neutral" || c.putBuildup !== "neutral"
  );

  const summary = useMemo(() => {
    const counts = { "long-buildup": 0, "short-buildup": 0, "long-unwinding": 0, "short-covering": 0, neutral: 0 };
    for (const c of classifications) {
      counts[c.callBuildup]++;
      counts[c.putBuildup]++;
    }
    return counts;
  }, [classifications]);

  const dominantSentiment =
    summary["long-buildup"] + summary["short-covering"] > summary["short-buildup"] + summary["long-unwinding"]
      ? "Bullish"
      : summary["short-buildup"] + summary["long-unwinding"] > summary["long-buildup"] + summary["short-covering"]
        ? "Bearish"
        : "Neutral";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>OI Buildup Analysis</span>
          <Badge variant={dominantSentiment === "Bullish" ? "bullish" : dominantSentiment === "Bearish" ? "bearish" : "default"}>
            {dominantSentiment}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="rounded-md border border-bullish/30 bg-bullish/10 p-1.5 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Long Build</p>
            <p className="text-sm font-bold text-bullish">{summary["long-buildup"]}</p>
          </div>
          <div className="rounded-md border border-bearish/30 bg-bearish/10 p-1.5 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Short Build</p>
            <p className="text-sm font-bold text-bearish">{summary["short-buildup"]}</p>
          </div>
          <div className="rounded-md border border-warning/30 bg-warning/10 p-1.5 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Long Unwind</p>
            <p className="text-sm font-bold text-warning">{summary["long-unwinding"]}</p>
          </div>
          <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-1.5 text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Short Cover</p>
            <p className="text-sm font-bold text-blue-400">{summary["short-covering"]}</p>
          </div>
        </div>

        <ScrollArea className="h-[200px]">
          <div className="space-y-1">
            <div className="grid grid-cols-[60px_1fr_60px_1fr_60px] gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Strike</span>
              <span>Call</span>
              <span>CE dOI</span>
              <span>Put</span>
              <span>PE dOI</span>
            </div>
            {(activeClassifications.length > 0 ? activeClassifications : classifications.slice(0, 15)).map((c) => (
              <div
                key={c.strike}
                className="grid grid-cols-[60px_1fr_60px_1fr_60px] items-center gap-1 text-xs"
              >
                <span className="font-mono font-semibold">{c.strike}</span>
                <BuildupBadge type={c.callBuildup} />
                <span className={c.callDeltaOi >= 0 ? "text-bullish" : "text-bearish"}>
                  {c.callDeltaOi > 0 ? "+" : ""}{Math.round(c.callDeltaOi).toLocaleString("en-IN")}
                </span>
                <BuildupBadge type={c.putBuildup} />
                <span className={c.putDeltaOi >= 0 ? "text-bullish" : "text-bearish"}>
                  {c.putDeltaOi > 0 ? "+" : ""}{Math.round(c.putDeltaOi).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
