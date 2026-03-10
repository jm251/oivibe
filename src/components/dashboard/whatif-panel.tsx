"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { computeWhatIf } from "@/lib/market/frontier-analytics";
import { UNDERLYINGS } from "@/lib/constants";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";

export function WhatIfPanel({
  rows,
  spot,
  symbol
}: {
  rows: OptionChainRow[];
  spot: number;
  symbol: SupportedSymbol;
}) {
  const lotSize = UNDERLYINGS[symbol]?.lotSize ?? 50;

  // Find ATM strike
  const atmStrike = rows.length
    ? rows.reduce((c, r) => (Math.abs(r.strike - spot) < Math.abs(c.strike - spot) ? r : c)).strike
    : Math.round(spot / 50) * 50;

  const [optionType, setOptionType] = useState<"CALL" | "PUT">("CALL");
  const [strike, setStrike] = useState(atmStrike);
  const [spotChange, setSpotChange] = useState(0);
  const [daysForward, setDaysForward] = useState(0);
  const [ivChange, setIvChange] = useState(0);

  // Get current option data
  const currentRow = rows.find((r) => r.strike === strike);
  const currentLeg = currentRow
    ? (optionType === "CALL" ? currentRow.call : currentRow.put)
    : null;

  const result = useMemo(() => {
    if (!currentLeg) return null;
    return computeWhatIf(
      optionType, spot, strike, currentLeg.ltp, currentLeg.iv,
      7, spotChange, daysForward, ivChange, lotSize
    );
  }, [optionType, spot, strike, currentLeg, spotChange, daysForward, ivChange, lotSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-bullish" />
          What-If Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Option selector */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] uppercase">Type</Label>
            <Select value={optionType} onValueChange={(v) => setOptionType(v as "CALL" | "PUT")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CALL">CALL (CE)</SelectItem>
                <SelectItem value="PUT">PUT (PE)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Strike</Label>
            <Select value={String(strike)} onValueChange={(v) => setStrike(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.strike} value={String(r.strike)}>
                    {r.strike} {r.strike === atmStrike ? "(ATM)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Current LTP</Label>
            <div className="flex h-8 items-center rounded-md border border-border bg-background/60 px-3 text-xs font-semibold">
              {currentLeg?.ltp.toFixed(2) ?? "-"}
            </div>
          </div>
        </div>

        {/* Scenario sliders */}
        <div className="space-y-3 rounded-md border border-border/70 bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Scenario Adjustments</p>

          <div>
            <div className="flex items-center justify-between text-xs">
              <Label>Spot Change</Label>
              <span className={`font-mono font-semibold ${spotChange >= 0 ? "text-bullish" : "text-bearish"}`}>
                {spotChange >= 0 ? "+" : ""}{spotChange} pts
              </span>
            </div>
            <input
              type="range"
              min={-Math.round(spot * 0.05)}
              max={Math.round(spot * 0.05)}
              step={symbol === "BANKNIFTY" ? 50 : 25}
              value={spotChange}
              onChange={(e) => setSpotChange(Number(e.target.value))}
              className="mt-1 w-full accent-bullish"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>-5%</span>
              <span>0</span>
              <span>+5%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <Label>Days Forward</Label>
              <span className="font-mono font-semibold text-warning">{daysForward}d</span>
            </div>
            <input
              type="range"
              min={0}
              max={7}
              step={1}
              value={daysForward}
              onChange={(e) => setDaysForward(Number(e.target.value))}
              className="mt-1 w-full accent-warning"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <Label>IV Change</Label>
              <span className={`font-mono font-semibold ${ivChange >= 0 ? "text-bearish" : "text-bullish"}`}>
                {ivChange >= 0 ? "+" : ""}{ivChange}%
              </span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={ivChange}
              onChange={(e) => setIvChange(Number(e.target.value))}
              className="mt-1 w-full accent-purple-400"
            />
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="col-span-1 rounded-lg border border-border/80 bg-background/60 p-2">
              <p className="text-[9px] uppercase text-muted-foreground">New Price</p>
              <p className="text-lg font-bold">{result.theoreticalPrice.toFixed(2)}</p>
            </div>
            <div className="col-span-1 rounded-lg border border-border/80 bg-background/60 p-2">
              <p className="text-[9px] uppercase text-muted-foreground">P&L (1 lot)</p>
              <p className={`text-lg font-bold ${result.pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                {result.pnl >= 0 ? "+" : ""}{result.pnl.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="col-span-1 rounded-lg border border-border/80 bg-background/60 p-2">
              <p className="text-[9px] uppercase text-muted-foreground">Change</p>
              <p className={`text-lg font-bold ${result.theoreticalPrice >= (currentLeg?.ltp ?? 0) ? "text-bullish" : "text-bearish"}`}>
                {currentLeg
                  ? `${((result.theoreticalPrice / currentLeg.ltp - 1) * 100).toFixed(1)}%`
                  : "-"}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/50 p-1.5 text-center">
              <p className="text-[8px] uppercase text-muted-foreground">Delta</p>
              <p className="font-semibold">{result.delta.toFixed(4)}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/50 p-1.5 text-center">
              <p className="text-[8px] uppercase text-muted-foreground">Gamma</p>
              <p className="font-semibold">{result.gamma.toFixed(5)}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/50 p-1.5 text-center">
              <p className="text-[8px] uppercase text-muted-foreground">Theta</p>
              <p className="font-semibold text-bearish">{result.theta.toFixed(2)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
