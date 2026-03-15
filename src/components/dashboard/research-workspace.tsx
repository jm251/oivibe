"use client";

import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { BuildupPanel } from "@/components/dashboard/buildup-panel";
import { ChainGridPanel } from "@/components/dashboard/chain-grid-panel";
import { FeatureGate } from "@/components/dashboard/feature-gate";
import { FiiDiiPanel } from "@/components/dashboard/fii-dii-panel";
import { FlowPanel } from "@/components/dashboard/flow-panel";
import { GexPanel } from "@/components/dashboard/gex-panel";
import { ImpliedMovePanel } from "@/components/dashboard/implied-move-panel";
import { IvPercentilePanel } from "@/components/dashboard/iv-percentile-panel";
import { IvSkewPanel } from "@/components/dashboard/iv-skew-panel";
import { MarketChartsPanel } from "@/components/dashboard/market-charts-panel";
import { MarketPulsePanel } from "@/components/dashboard/market-pulse-panel";
import { MaxPainPanel } from "@/components/dashboard/max-pain-panel";
import { MultiStrikePanel } from "@/components/dashboard/multi-strike-panel";
import { OiHeatmapPanel } from "@/components/dashboard/oi-heatmap-panel";
import { PnlHeatmapPanel } from "@/components/dashboard/pnl-heatmap-panel";
import { ReplayCachePanel } from "@/components/dashboard/replay-cache-panel";
import { StraddlePanel } from "@/components/dashboard/straddle-panel";
import { StrategyLabPanel } from "@/components/dashboard/strategy-lab-panel";
import { UoaPanel } from "@/components/dashboard/uoa-panel";
import { VolSurfacePanel } from "@/components/dashboard/vol-surface-panel";
import { WhatIfPanel } from "@/components/dashboard/whatif-panel";
import { ChainAggregates, OptionChainRow, SupportedSymbol } from "@/lib/types";

interface TimelinePoint {
  time: number;
  spot: number;
  callOi: number;
  putOi: number;
}

interface ResearchWorkspaceProps {
  symbol: SupportedSymbol;
  expiry: string;
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
  spot: number;
  timeline: TimelinePoint[];
}

function SectionLabel({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
    </div>
  );
}

export function ResearchWorkspace({ symbol, expiry, rows, aggregates, spot, timeline }: ResearchWorkspaceProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SectionLabel eyebrow="Research" title="Market Structure" />
        <MarketPulsePanel rows={rows} spot={spot} symbol={symbol} pcrOi={aggregates.pcrOi} />
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 xl:col-span-4 xl:block">
            <OiHeatmapPanel rows={rows} />
            <FlowPanel aggregates={aggregates} />
            <MaxPainPanel rows={rows} spot={spot} />
          </div>
          <div className="flex min-h-0 flex-col gap-4 xl:col-span-8">
            <MarketChartsPanel timeline={timeline} />
            <div className="min-h-0 flex-1">
              <FeatureGate feature="full-chain" title="Option Chain Grid">
                <ChainGridPanel rows={rows} spot={spot} variant="research" />
              </FeatureGate>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel eyebrow="Scanners" title="Trade Discovery" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BuildupPanel rows={rows} />
          <StraddlePanel rows={rows} spot={spot} symbol={symbol} />
          <GexPanel rows={rows} spot={spot} symbol={symbol} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <MultiStrikePanel rows={rows} spot={spot} />
          <UoaPanel rows={rows} symbol={symbol} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel eyebrow="Decision Support" title="Scenario and Positioning" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ImpliedMovePanel spot={spot} symbol={symbol} />
          <IvPercentilePanel rows={rows} spot={spot} symbol={symbol} />
          <WhatIfPanel rows={rows} spot={spot} symbol={symbol} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <FiiDiiPanel spot={spot} />
          <AlertsPanel rows={rows} aggregates={aggregates} spot={spot} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel eyebrow="Strategy" title="Payoff and Volatility Tools" />
        <div className="grid gap-4 xl:grid-cols-2">
          <IvSkewPanel rows={rows} spot={spot} />
          <FeatureGate feature="strategy-lab" title="Strategy Lab">
            <StrategyLabPanel />
          </FeatureGate>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <FeatureGate feature="strategy-lab" title="P&L Heatmap">
            <PnlHeatmapPanel />
          </FeatureGate>
          <FeatureGate feature="vol-surface" title="3D Volatility Surface">
            <VolSurfacePanel rows={rows} />
          </FeatureGate>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel eyebrow="Replay" title="Session Archive" />
        <ReplayCachePanel symbol={symbol} expiry={expiry} />
      </section>
    </div>
  );
}
