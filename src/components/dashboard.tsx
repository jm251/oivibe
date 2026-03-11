"use client";

import { formatDistanceToNowStrict } from "date-fns";

import { useExpiries, useMarketStream, useOptionChain, useSessionStatus } from "@/hooks/use-market-data";
import { useMarketStore } from "@/store/market-store";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { BuildupPanel } from "@/components/dashboard/buildup-panel";
import { ChainGridPanel } from "@/components/dashboard/chain-grid-panel";
import { CommandBar } from "@/components/dashboard/command-bar";
import { CommandPalette } from "@/components/dashboard/command-palette";
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
import { StraddlePanel } from "@/components/dashboard/straddle-panel";
import { StrategyLabPanel } from "@/components/dashboard/strategy-lab-panel";
import { UoaPanel } from "@/components/dashboard/uoa-panel";
import { UsageBanner } from "@/components/dashboard/usage-banner";
import { VolSurfacePanel } from "@/components/dashboard/vol-surface-panel";
import { WhatIfPanel } from "@/components/dashboard/whatif-panel";
import { ReplayCachePanel } from "@/components/dashboard/replay-cache-panel";
import { useReplayRecorder } from "@/hooks/use-replay-cache";

export function Dashboard() {
  const { symbol, expiry, rows, aggregates, spot, updatedAt, timeline } = useMarketStore();

  useSessionStatus();
  const expiriesQuery = useExpiries(symbol);
  useOptionChain(symbol, expiry);
  useMarketStream(symbol, expiry);
  useReplayRecorder();

  return (
    <>
      <CommandPalette />
      <main className="mx-auto min-h-screen max-w-[1700px] p-4 sm:p-6">
        <div className="space-y-4">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-bullish">
              OI VIBE - 2026 Trader Stack
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Live NSE F&O Intelligence Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Spot {spot.toLocaleString("en-IN", { maximumFractionDigits: 2 })} - Updated{" "}
              {updatedAt
                ? formatDistanceToNowStrict(new Date(updatedAt), { addSuffix: true })
                : "-"}
            </p>
          </header>

          <UsageBanner />

          <CommandBar
            expiries={expiriesQuery.data?.expiries ?? []}
            loadingExpiries={expiriesQuery.isLoading || expiriesQuery.isFetching}
          />

          {/* Market Pulse - AI Summary (full width) */}
          <MarketPulsePanel rows={rows} spot={spot} symbol={symbol} pcrOi={aggregates.pcrOi} />

          {/* Row 1: Heatmap + Flow + Max Pain | Charts + Chain */}
          <section className="grid gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-4">
              <OiHeatmapPanel rows={rows} />
              <FlowPanel aggregates={aggregates} />
              <MaxPainPanel rows={rows} spot={spot} />
            </div>
            <div className="flex min-h-0 flex-col gap-4 xl:col-span-8">
              <MarketChartsPanel timeline={timeline} />
              <div className="min-h-0 flex-1">
                <FeatureGate feature="full-chain" title="Option Chain Grid">
                  <ChainGridPanel rows={rows} />
                </FeatureGate>
              </div>
            </div>
          </section>

          <section>
            <ReplayCachePanel symbol={symbol} expiry={expiry} />
          </section>

          {/* Row 2: Buildup + Straddle + GEX */}
          <section className="grid gap-4 xl:grid-cols-3">
            <BuildupPanel rows={rows} />
            <StraddlePanel rows={rows} spot={spot} symbol={symbol} />
            <GexPanel rows={rows} spot={spot} symbol={symbol} />
          </section>

          {/* Row 3: Multi-Strike + UOA Scanner */}
          <section className="grid gap-4 xl:grid-cols-2">
            <MultiStrikePanel rows={rows} spot={spot} />
            <UoaPanel rows={rows} symbol={symbol} />
          </section>

          {/* Row 4: Implied Move + IV Percentile + What-If */}
          <section className="grid gap-4 xl:grid-cols-3">
            <ImpliedMovePanel spot={spot} symbol={symbol} />
            <IvPercentilePanel rows={rows} spot={spot} symbol={symbol} />
            <WhatIfPanel rows={rows} spot={spot} symbol={symbol} />
          </section>

          {/* Row 5: FII/DII + Alerts */}
          <section className="grid gap-4 xl:grid-cols-2">
            <FiiDiiPanel spot={spot} />
            <AlertsPanel rows={rows} aggregates={aggregates} spot={spot} />
          </section>

          {/* Row 6: IV Skew + Strategy Lab (Pro) */}
          <section className="grid gap-4 xl:grid-cols-2">
            <IvSkewPanel rows={rows} spot={spot} />
            <FeatureGate feature="strategy-lab" title="Strategy Lab">
              <StrategyLabPanel />
            </FeatureGate>
          </section>

          {/* Row 7: P&L Heatmap + Vol Surface (Pro) */}
          <section className="grid gap-4 xl:grid-cols-2">
            <FeatureGate feature="strategy-lab" title="P&L Heatmap">
              <PnlHeatmapPanel />
            </FeatureGate>
            <FeatureGate feature="vol-surface" title="3D Volatility Surface">
              <VolSurfacePanel rows={rows} />
            </FeatureGate>
          </section>
        </div>
      </main>
    </>
  );
}
