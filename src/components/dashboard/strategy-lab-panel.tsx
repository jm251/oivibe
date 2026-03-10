"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeStrategySnapshot, templateLegs } from "@/lib/strategy/payoff";
import { OptionLeg } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { useStrategyStore } from "@/store/strategy-store";

export function StrategyLabPanel() {
  const spot = useMarketStore((state) => state.spot);
  const symbol = useMarketStore((state) => state.symbol);

  const {
    legs,
    template,
    quantity,
    setTemplate,
    setQuantity,
    setLegs,
    addLeg,
    updateLeg,
    removeLeg
  } = useStrategyStore();

  const lotSize = symbol === "BANKNIFTY" ? 15 : symbol === "FINNIFTY" ? 25 : 50;

  useEffect(() => {
    if (legs.length === 0 && spot > 0) {
      setLegs(templateLegs(template, spot, lotSize));
    }
  }, [legs.length, lotSize, setLegs, spot, template]);

  const strategy = useMemo(
    () =>
      computeStrategySnapshot({
        spot,
        iv: 14,
        lotSize,
        legs: legs.map((leg) => ({ ...leg, quantity }))
      }),
    [legs, lotSize, quantity, spot]
  );

  const linePoints = useMemo(() => {
    if (!strategy.payoffSeries.length) return "";
    const pnlValues = strategy.payoffSeries.map((point) => point.pnl);
    const min = Math.min(...pnlValues);
    const max = Math.max(...pnlValues);
    const range = max - min || 1;

    return strategy.payoffSeries
      .map((point, idx, arr) => {
        const x = (idx / (arr.length - 1 || 1)) * 100;
        const y = 100 - ((point.pnl - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [strategy.payoffSeries]);

  const handleTemplateChange = (
    nextTemplate: "longStraddle" | "shortStrangle" | "bullCallSpread"
  ) => {
    setTemplate(nextTemplate);
    setLegs(templateLegs(nextTemplate, spot || 22500, lotSize));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Lab</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={template}
          onValueChange={(value) => handleTemplateChange(value as typeof template)}
        >
          <TabsList>
            <TabsTrigger value="longStraddle">Long Straddle</TabsTrigger>
            <TabsTrigger value="shortStrangle">Short Strangle</TabsTrigger>
            <TabsTrigger value="bullCallSpread">Bull Call Spread</TabsTrigger>
          </TabsList>

          <TabsContent value={template}>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-[1fr_auto]">
              <label className="space-y-1">
                <span className="text-muted-foreground">Quantity</span>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Number(event.target.value || 1)))
                  }
                />
              </label>
              <button
                type="button"
                className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs hover:bg-accent"
                onClick={() =>
                  addLeg({
                    id: crypto.randomUUID(),
                    side: "BUY",
                    optionType: "CALL",
                    strike: Math.round((spot || 22500) / 50) * 50,
                    premium: 100,
                    quantity: 1,
                    iv: 14,
                    daysToExpiry: 7,
                    lotSize
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Leg
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {legs.map((leg) => (
                <div
                  key={leg.id}
                  className="grid grid-cols-6 gap-2 rounded-md border border-border/80 bg-background/60 p-2 text-xs"
                >
                  <Select
                    value={leg.side}
                    onValueChange={(value) =>
                      updateLeg(leg.id, { side: value as OptionLeg["side"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={leg.optionType}
                    onValueChange={(value) =>
                      updateLeg(leg.id, { optionType: value as OptionLeg["optionType"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">CALL</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={leg.strike}
                    onChange={(event) =>
                      updateLeg(leg.id, { strike: Number(event.target.value || 0) })
                    }
                  />
                  <Input
                    type="number"
                    value={leg.premium}
                    onChange={(event) =>
                      updateLeg(leg.id, { premium: Number(event.target.value || 0) })
                    }
                  />
                  <Input
                    type="number"
                    value={leg.quantity}
                    onChange={(event) =>
                      updateLeg(leg.id, { quantity: Number(event.target.value || 1) })
                    }
                  />
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border border-border px-2 hover:bg-accent"
                    onClick={() => removeLeg(leg.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md border border-border/80 bg-background/60 p-3">
              <svg viewBox="0 0 100 100" className="h-32 w-full rounded bg-[#05080f]">
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="#00ff7e"
                  strokeWidth="1.7"
                />
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="rgba(201,211,230,0.25)"
                  strokeWidth="0.5"
                />
              </svg>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <Metric label="Break-evens" value={strategy.breakEvens.join(", ") || "-"} />
                <Metric
                  label="Max Profit"
                  value={strategy.maxProfit.toLocaleString("en-IN")}
                  tone="bull"
                />
                <Metric
                  label="Max Loss"
                  value={strategy.maxLoss.toLocaleString("en-IN")}
                  tone="bear"
                />
                <Metric
                  label="Greeks (?/G/T/V)"
                  value={`${strategy.greeks.delta} / ${strategy.greeks.gamma} / ${strategy.greeks.theta} / ${strategy.greeks.vega}`}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background/60 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={
          tone === "bull"
            ? "text-bullish"
            : tone === "bear"
              ? "text-bearish"
              : "text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}