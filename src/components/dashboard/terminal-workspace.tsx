"use client";

import {
  Activity,
  BarChart3,
  History,
  LayoutGrid,
  Plus,
  Radar,
  Target,
  Zap
} from "lucide-react";
import { useEffect, useMemo } from "react";

import { BuildupPanel } from "@/components/dashboard/buildup-panel";
import { FeatureGate } from "@/components/dashboard/feature-gate";
import { FlowPanel } from "@/components/dashboard/flow-panel";
import { MarketChartsPanel } from "@/components/dashboard/market-charts-panel";
import { MarketPulsePanel } from "@/components/dashboard/market-pulse-panel";
import { MaxPainPanel } from "@/components/dashboard/max-pain-panel";
import { OiHeatmapPanel } from "@/components/dashboard/oi-heatmap-panel";
import { ReplayCachePanel } from "@/components/dashboard/replay-cache-panel";
import { UoaPanel } from "@/components/dashboard/uoa-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeStrategySnapshot, templateLegs } from "@/lib/strategy/payoff";
import { ChainAggregates, OptionChainRow, OptionContract, OptionLeg, SupportedSymbol } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market-store";
import {
  ChainPreset,
  ChainWindow,
  TerminalChartView,
  TerminalDockView,
  useWorkspaceStore
} from "@/store/workspace-store";
import { useStrategyStore } from "@/store/strategy-store";
import { ChainGridPanel } from "./chain-grid-panel";

interface TimelinePoint {
  time: number;
  spot: number;
  callOi: number;
  putOi: number;
}

interface TerminalWorkspaceProps {
  symbol: SupportedSymbol;
  expiry: string;
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
  spot: number;
  timeline: TimelinePoint[];
}

const chartTabs: Array<{ id: TerminalChartView; label: string }> = [
  { id: "timeline", label: "Spot / OI" },
  { id: "flow", label: "Flow" },
  { id: "walls", label: "Walls" }
];

const dockTabs: Array<{
  id: TerminalDockView;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "buildup", label: "Buildup", icon: Activity },
  { id: "pulse", label: "Pulse", icon: BarChart3 },
  { id: "uoa", label: "Scanner", icon: Radar },
  { id: "replay", label: "Replay", icon: History }
];

const chainWindows: Array<{ value: ChainWindow; label: string }> = [
  { value: "atm-8", label: "ATM +/- 8" },
  { value: "atm-16", label: "ATM +/- 16" },
  { value: "atm-24", label: "ATM +/- 24" },
  { value: "all", label: "Full Chain" }
];

const chainPresets: Array<{ value: ChainPreset; label: string }> = [
  { value: "quick", label: "Quick" },
  { value: "pro", label: "Pro" }
];

function getLotSize(symbol: SupportedSymbol) {
  if (symbol === "BANKNIFTY") return 15;
  if (symbol === "FINNIFTY") return 25;
  return 50;
}

function findAtmRow(rows: OptionChainRow[], spot: number) {
  if (!rows.length) {
    return null;
  }

  return rows.reduce((closest, row) => {
    if (!closest) {
      return row;
    }

    return Math.abs(row.strike - spot) < Math.abs(closest.strike - spot)
      ? row
      : closest;
  }, rows[0] ?? null);
}

function buildLeg(contract: OptionContract, side: OptionLeg["side"], lotSize: number): OptionLeg {
  return {
    id: crypto.randomUUID(),
    side,
    optionType: contract.optionType,
    strike: contract.strike,
    premium: contract.ltp,
    quantity: 1,
    iv: contract.iv,
    daysToExpiry: 6,
    lotSize,
    greeks: contract.greeks
  };
}

function MetricTile({
  label,
  value,
  tone,
  helper
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "bull" | "bear" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-3 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-lg font-semibold tracking-tight",
          tone === "bull"
            ? "text-bullish"
            : tone === "bear"
              ? "text-bearish"
              : "text-foreground"
        )}
      >
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function WorkspaceRail() {
  const setWorkspaceMode = useWorkspaceStore((state) => state.setWorkspaceMode);
  const terminalDockView = useWorkspaceStore((state) => state.terminalDockView);
  const setTerminalDockView = useWorkspaceStore((state) => state.setTerminalDockView);

  return (
    <aside className="hidden xl:flex xl:flex-col xl:gap-2">
      <RailButton icon={LayoutGrid} label="Terminal" active onClick={() => setWorkspaceMode("terminal")} />
      <RailButton icon={Radar} label="Research" onClick={() => setWorkspaceMode("research")} />
      <div className="my-2 h-px bg-border/80" />
      {dockTabs.map((tab) => (
        <RailButton
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={terminalDockView === tab.id}
          onClick={() => setTerminalDockView(tab.id)}
        />
      ))}
    </aside>
  );
}

function RailButton({
  icon: Icon,
  label,
  active = false,
  onClick
}: {
  icon: typeof Activity;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border/70 bg-card/70 text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition hover:border-primary/40 hover:text-foreground",
        active && "border-primary/60 bg-primary/10 text-primary shadow-neon"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function SelectedContractPanel({
  symbol,
  selectedRow,
  spot
}: {
  symbol: SupportedSymbol;
  selectedRow: OptionChainRow | null;
  spot: number;
}) {
  const addLeg = useStrategyStore((state) => state.addLeg);
  const lotSize = getLotSize(symbol);

  if (!selectedRow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selected Strike</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Pick a strike from the chain to stage legs and inspect live microstructure.</p>
        </CardContent>
      </Card>
    );
  }

  const distance = selectedRow.strike - spot;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Strike Focus
          </span>
          <Badge variant="warning">{selectedRow.strike.toLocaleString("en-IN")}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <ContractCell contract={selectedRow.call} label="Call" tone="bear" />
          <ContractCell contract={selectedRow.put} label="Put" tone="bull" />
        </div>
        <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
          Spot distance <span className={distance <= 0 ? "text-bullish" : "text-bearish"}>{distance > 0 ? "+" : ""}{distance.toFixed(0)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => addLeg(buildLeg(selectedRow.call, "BUY", lotSize))}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Buy CE
          </Button>
          <Button size="sm" variant="outline" onClick={() => addLeg(buildLeg(selectedRow.call, "SELL", lotSize))}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Sell CE
          </Button>
          <Button size="sm" variant="outline" onClick={() => addLeg(buildLeg(selectedRow.put, "BUY", lotSize))}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Buy PE
          </Button>
          <Button size="sm" variant="outline" onClick={() => addLeg(buildLeg(selectedRow.put, "SELL", lotSize))}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Sell PE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractCell({
  label,
  contract,
  tone
}: {
  label: string;
  contract: OptionContract;
  tone: "bull" | "bear";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-lg font-semibold", tone === "bull" ? "text-bullish" : "text-bearish")}>{contract.ltp.toFixed(2)}</p>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>OI</span>
          <span>{Math.round(contract.oi).toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Delta OI</span>
          <span className={contract.deltaOi >= 0 ? "text-bullish" : "text-bearish"}>{Math.round(contract.deltaOi).toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>IV</span>
          <span>{contract.iv.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function QuickStrategyPanel({ symbol, spot }: { symbol: SupportedSymbol; spot: number }) {
  const { legs, setLegs, quantity, setQuantity } = useStrategyStore();
  const setWorkspaceMode = useWorkspaceStore((state) => state.setWorkspaceMode);
  const lotSize = getLotSize(symbol);

  const snapshot = useMemo(
    () =>
      computeStrategySnapshot({
        spot,
        iv: 14,
        lotSize,
        legs: legs.map((leg) => ({ ...leg, quantity }))
      }),
    [legs, lotSize, quantity, spot]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            Strategy Quick Build
          </span>
          <Badge variant="warning">{legs.length} legs</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" onClick={() => setLegs(templateLegs("longStraddle", spot || 22500, lotSize))}>
            Straddle
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLegs(templateLegs("shortStrangle", spot || 22500, lotSize))}>
            Strangle
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLegs(templateLegs("bullCallSpread", spot || 22500, lotSize))}>
            Spread
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <MetricTile label="Break-evens" value={snapshot.breakEvens.length ? snapshot.breakEvens.join(", ") : "-"} />
          <MetricTile label="Quantity" value={String(quantity)} helper={`Lot ${lotSize}`} />
          <MetricTile label="Max Profit" value={snapshot.maxProfit.toLocaleString("en-IN")} tone="bull" />
          <MetricTile label="Max Loss" value={snapshot.maxLoss.toLocaleString("en-IN")} tone="bear" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => setQuantity(Math.max(1, quantity + 1))}>
            Scale +1
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWorkspaceMode("research")}>
            Full Lab
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TerminalWorkspace({ symbol, expiry, rows, aggregates, spot, timeline }: TerminalWorkspaceProps) {
  const {
    terminalChartView,
    terminalDockView,
    setTerminalChartView,
    setTerminalDockView,
    setWorkspaceMode,
    selectedStrike,
    setSelectedStrike,
    chainPreset,
    setChainPreset,
    chainWindow,
    setChainWindow
  } = useWorkspaceStore();
  const replayActive = useMarketStore((state) => state.replayActive);

  const atmRow = useMemo(() => findAtmRow(rows, spot), [rows, spot]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.strike === selectedStrike) ?? atmRow,
    [atmRow, rows, selectedStrike]
  );

  useEffect(() => {
    if (!rows.length) {
      if (selectedStrike !== null) {
        setSelectedStrike(null);
      }
      return;
    }

    const hasSelectedStrike = selectedStrike !== null && rows.some((row) => row.strike === selectedStrike);
    if (!hasSelectedStrike && atmRow) {
      setSelectedStrike(atmRow.strike);
    }
  }, [atmRow, rows, selectedStrike, setSelectedStrike]);

  const topCallWall = aggregates.topCallWalls[0];
  const topPutWall = aggregates.topPutWalls[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-muted-foreground">Terminal</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Chain-first intraday workspace</h2>
        </div>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {chainWindows.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={chainWindow === option.value ? "default" : "outline"}
              onClick={() => setChainWindow(option.value)}
            >
              {option.label}
            </Button>
          ))}
          {chainPresets.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={chainPreset === option.value ? "secondary" : "outline"}
              onClick={() => setChainPreset(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
        <MetricTile
          label="Spot"
          value={spot.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          helper={replayActive ? "Replay snapshot" : `${symbol} live`}
        />
        <MetricTile label="PCR OI" value={aggregates.pcrOi.toFixed(2)} tone={aggregates.pcrOi >= 1 ? "bull" : "bear"} />
        <MetricTile
          label="Call Wall"
          value={topCallWall ? topCallWall.strike.toLocaleString("en-IN") : "-"}
          helper={topCallWall ? topCallWall.oi.toLocaleString("en-IN") : "No wall"}
          tone="bear"
        />
        <MetricTile
          label="Put Wall"
          value={topPutWall ? topPutWall.strike.toLocaleString("en-IN") : "-"}
          helper={topPutWall ? topPutWall.oi.toLocaleString("en-IN") : "No wall"}
          tone="bull"
        />
        <MetricTile
          label="Active Strike"
          value={selectedRow ? selectedRow.strike.toLocaleString("en-IN") : "-"}
          helper={expiry || "Awaiting expiry"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[72px_minmax(0,1fr)_360px]">
        <WorkspaceRail />

        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Live Lens</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">Primary market view</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {chartTabs.map((tab) => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={terminalChartView === tab.id ? "default" : "outline"}
                    onClick={() => setTerminalChartView(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
            {terminalChartView === "timeline" ? <MarketChartsPanel timeline={timeline} /> : null}
            {terminalChartView === "flow" ? <FlowPanel aggregates={aggregates} /> : null}
            {terminalChartView === "walls" ? <OiHeatmapPanel rows={rows} /> : null}
          </section>

          <section>
            <FeatureGate feature="full-chain" title="Option Chain Terminal">
              <ChainGridPanel rows={rows} spot={spot} variant="terminal" />
            </FeatureGate>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Dock</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">Secondary analytics</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {dockTabs.map((tab) => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={terminalDockView === tab.id ? "secondary" : "outline"}
                    onClick={() => setTerminalDockView(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => setWorkspaceMode("research")}>
                  Research Mode
                </Button>
              </div>
            </div>

            {terminalDockView === "buildup" ? <BuildupPanel rows={rows} /> : null}
            {terminalDockView === "pulse" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <FlowPanel aggregates={aggregates} />
                <OiHeatmapPanel rows={rows} />
              </div>
            ) : null}
            {terminalDockView === "uoa" ? <UoaPanel rows={rows} symbol={symbol} /> : null}
            {terminalDockView === "replay" ? <ReplayCachePanel symbol={symbol} expiry={expiry} /> : null}
          </section>
        </div>

        <div className="space-y-4">
          <SelectedContractPanel symbol={symbol} selectedRow={selectedRow} spot={spot} />
          <FeatureGate feature="strategy-lab" title="Strategy Quick Build">
            <QuickStrategyPanel symbol={symbol} spot={spot} />
          </FeatureGate>
          <MarketPulsePanel rows={rows} spot={spot} symbol={symbol} pcrOi={aggregates.pcrOi} />
          <MaxPainPanel rows={rows} spot={spot} />
        </div>
      </div>
    </div>
  );
}
