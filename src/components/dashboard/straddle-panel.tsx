"use client";

import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeStraddleData } from "@/lib/market/advanced-analytics";
import { OptionChainRow, SupportedSymbol } from "@/lib/types";

export function StraddlePanel({
  rows,
  spot,
  symbol
}: {
  rows: OptionChainRow[];
  spot: number;
  symbol: SupportedSymbol;
}) {
  const data = useMemo(() => computeStraddleData(rows, spot, symbol), [rows, spot, symbol]);

  if (!data.atmStrike) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-bullish" />
            Expected Move
          </span>
          <Badge variant="bullish">{data.expectedMovePercent}%</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/80 bg-background/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ATM Straddle</p>
            <p className="text-xl font-bold text-foreground">
              {data.straddlePremium.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-muted-foreground">
              Strike {data.atmStrike.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ATM Strangle</p>
            <p className="text-xl font-bold text-foreground">
              {data.stranglePremium.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.stranglePutStrike} / {data.strangleCallStrike}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-background/60 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Expected Range at Expiry
          </p>
          <div className="relative h-8">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-bullish/40"
              style={{
                left: `${Math.max(5, ((data.lowerBreakeven - (spot - data.expectedMovePoints * 2)) / (data.expectedMovePoints * 4)) * 100)}%`,
                right: `${Math.max(5, 100 - ((data.upperBreakeven - (spot - data.expectedMovePoints * 2)) / (data.expectedMovePoints * 4)) * 100)}%`
              }}
            />
            <div
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground"
              style={{ left: "50%" }}
              title={`Spot: ${spot}`}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-bearish">
              <ArrowDownRight className="h-3 w-3" />
              {data.lowerBreakeven.toLocaleString("en-IN")}
            </span>
            <span className="text-muted-foreground">
              Spot: {spot.toLocaleString("en-IN")}
            </span>
            <span className="flex items-center gap-1 text-bullish">
              <ArrowUpRight className="h-3 w-3" />
              {data.upperBreakeven.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">CE Premium</p>
            <p className="font-semibold">{data.callPremium.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-md border border-border/80 bg-background/60 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">PE Premium</p>
            <p className="font-semibold">{data.putPremium.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
