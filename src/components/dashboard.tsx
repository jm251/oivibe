"use client";

import { formatDistanceToNowStrict } from "date-fns";

import { CommandBar } from "@/components/dashboard/command-bar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { ResearchWorkspace } from "@/components/dashboard/research-workspace";
import { TerminalWorkspace } from "@/components/dashboard/terminal-workspace";
import { UsageBanner } from "@/components/dashboard/usage-banner";
import { useExpiries, useMarketStream, useOptionChain, useSessionStatus } from "@/hooks/use-market-data";
import { useReplayRecorder } from "@/hooks/use-replay-cache";
import { useMarketStore } from "@/store/market-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export function Dashboard() {
  const { symbol, expiry, rows, aggregates, spot, updatedAt, timeline } = useMarketStore();
  const workspaceMode = useWorkspaceStore((state) => state.workspaceMode);

  useSessionStatus();
  const expiriesQuery = useExpiries(symbol);
  useOptionChain(symbol, expiry);
  useMarketStream(symbol, expiry);
  useReplayRecorder();

  return (
    <>
      <CommandPalette />
      <main className="mx-auto min-h-screen max-w-[1820px] px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
        <div className="space-y-4">
          <header className="rounded-[24px] border border-border/80 bg-card/85 px-4 py-4 backdrop-blur-sm sm:rounded-[28px] sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.34em] text-bullish">OI VIBE 2026 Terminal</p>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
                  Live NSE F&O intelligence for fast index decisions
                </h1>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Spot {spot.toLocaleString("en-IN", { maximumFractionDigits: 2 })} - Updated{" "}
                  {updatedAt
                    ? formatDistanceToNowStrict(new Date(updatedAt), { addSuffix: true })
                    : "-"}
                </p>
              </div>
              <div className="max-w-xl text-xs text-muted-foreground sm:text-sm xl:text-right">
                {workspaceMode === "terminal"
                  ? "Terminal mode keeps the option chain, live context, and quick strategy actions in one working surface."
                  : "Research mode exposes the full analytics stack for deeper scanning, replay, and structured strategy work."}
              </div>
            </div>
          </header>

          {workspaceMode === "research" ? <UsageBanner /> : null}

          <CommandBar
            expiries={expiriesQuery.data?.expiries ?? []}
            loadingExpiries={expiriesQuery.isLoading || expiriesQuery.isFetching}
          />

          {workspaceMode === "terminal" ? (
            <TerminalWorkspace
              symbol={symbol}
              expiry={expiry}
              rows={rows}
              aggregates={aggregates}
              spot={spot}
              timeline={timeline}
            />
          ) : (
            <ResearchWorkspace
              symbol={symbol}
              expiry={expiry}
              rows={rows}
              aggregates={aggregates}
              spot={spot}
              timeline={timeline}
            />
          )}
        </div>
      </main>
    </>
  );
}
