"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OptionChainRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

interface ChainGridPanelProps {
  rows: OptionChainRow[];
  spot: number;
  variant?: "terminal" | "research";
}

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0
});

function findAtmIndex(rows: OptionChainRow[], spot: number) {
  if (!rows.length) {
    return -1;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  rows.forEach((row, index) => {
    const distance = Math.abs(row.strike - spot);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function sliceRows(rows: OptionChainRow[], spot: number, window: "atm-8" | "atm-16" | "atm-24" | "all") {
  if (window === "all") {
    return rows;
  }

  const spread = window === "atm-8" ? 8 : window === "atm-16" ? 16 : 24;
  const atmIndex = findAtmIndex(rows, spot);
  if (atmIndex < 0) {
    return rows;
  }

  return rows.slice(Math.max(0, atmIndex - spread), Math.min(rows.length, atmIndex + spread + 1));
}

function DeltaCell({ value }: { value: number }) {
  const positive = value >= 0;

  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", positive ? "text-bullish" : "text-bearish")}>
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {numberFormatter.format(Math.round(value))}
    </span>
  );
}

function HeaderCell({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <th className={cn("bg-card/95 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground", className)}>
      {children}
    </th>
  );
}

function DataCell({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <td className={cn("px-3 py-3 text-sm text-foreground", className)}>{children}</td>;
}

export function ChainGridPanel({ rows, spot, variant = "research" }: ChainGridPanelProps) {
  const selectedStrike = useWorkspaceStore((state) => state.selectedStrike);
  const setSelectedStrike = useWorkspaceStore((state) => state.setSelectedStrike);
  const chainWindow = useWorkspaceStore((state) => state.chainWindow);
  const chainPreset = useWorkspaceStore((state) => state.chainPreset);

  const visibleRows = useMemo(() => sliceRows(rows, spot, chainWindow), [rows, spot, chainWindow]);
  const atmIndex = useMemo(() => findAtmIndex(visibleRows, spot), [spot, visibleRows]);
  const isProPreset = chainPreset === "pro";

  return (
    <Card className={cn("flex h-full min-h-[420px] flex-col overflow-hidden sm:min-h-[520px]", variant === "terminal" && "border-primary/15 bg-card/[0.9]")}>
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span>Option Chain Terminal</span>
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              Click a strike to stage quick strategy actions and contextual analytics.
            </p>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-xs sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <Badge variant="warning">{visibleRows.length} strikes</Badge>
            <Badge variant="default">{chainPreset.toUpperCase()}</Badge>
            <Badge variant="default">{chainWindow.toUpperCase()}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className={cn("h-full w-full", variant === "terminal" ? "max-h-[640px] sm:max-h-[720px]" : "max-h-[560px] sm:max-h-[640px]")}>
          <table className="w-max min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
              <tr>
                {isProPreset ? <HeaderCell>Bid</HeaderCell> : null}
                <HeaderCell>Call LTP</HeaderCell>
                <HeaderCell>Call OI</HeaderCell>
                <HeaderCell>Call Delta OI</HeaderCell>
                <HeaderCell>Call Vol</HeaderCell>
                {isProPreset ? <HeaderCell>Call IV</HeaderCell> : null}
                <HeaderCell className="sticky left-0 z-30 border-x border-border/60 bg-background text-center text-foreground">
                  Strike
                </HeaderCell>
                {isProPreset ? <HeaderCell>Put IV</HeaderCell> : null}
                <HeaderCell>Put Vol</HeaderCell>
                <HeaderCell>Put Delta OI</HeaderCell>
                <HeaderCell>Put OI</HeaderCell>
                <HeaderCell>Put LTP</HeaderCell>
                {isProPreset ? <HeaderCell>Ask</HeaderCell> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const isSelected = row.strike === selectedStrike;
                const isAtm = index === atmIndex;

                return (
                  <tr
                    key={row.strike}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-primary/6",
                      isSelected && "bg-primary/10",
                      isAtm && !isSelected && "bg-warning/6"
                    )}
                    onClick={() => setSelectedStrike(row.strike)}
                  >
                    {isProPreset ? (
                      <DataCell className="font-mono text-xs text-muted-foreground">{row.call.bid.toFixed(2)}</DataCell>
                    ) : null}
                    <DataCell className="font-mono text-sm">{row.call.ltp.toFixed(2)}</DataCell>
                    <DataCell className="font-mono text-xs text-muted-foreground">{numberFormatter.format(Math.round(row.call.oi))}</DataCell>
                    <DataCell className="font-mono text-xs"><DeltaCell value={row.call.deltaOi} /></DataCell>
                    <DataCell className="font-mono text-xs text-muted-foreground">{numberFormatter.format(Math.round(row.call.volume))}</DataCell>
                    {isProPreset ? (
                      <DataCell className="font-mono text-xs text-muted-foreground">{row.call.iv.toFixed(1)}%</DataCell>
                    ) : null}
                    <DataCell className="sticky left-0 z-10 border-x border-border/60 bg-background/95 text-center font-semibold tracking-[0.08em]">
                      <div className="flex flex-col items-center gap-1">
                        <span>{row.strike}</span>
                        {isAtm ? <span className="text-[10px] uppercase tracking-[0.24em] text-warning">ATM</span> : null}
                      </div>
                    </DataCell>
                    {isProPreset ? (
                      <DataCell className="font-mono text-xs text-muted-foreground">{row.put.iv.toFixed(1)}%</DataCell>
                    ) : null}
                    <DataCell className="font-mono text-xs text-muted-foreground">{numberFormatter.format(Math.round(row.put.volume))}</DataCell>
                    <DataCell className="font-mono text-xs"><DeltaCell value={row.put.deltaOi} /></DataCell>
                    <DataCell className="font-mono text-xs text-muted-foreground">{numberFormatter.format(Math.round(row.put.oi))}</DataCell>
                    <DataCell className="font-mono text-sm">{row.put.ltp.toFixed(2)}</DataCell>
                    {isProPreset ? (
                      <DataCell className="font-mono text-xs text-muted-foreground">{row.put.ask.toFixed(2)}</DataCell>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
