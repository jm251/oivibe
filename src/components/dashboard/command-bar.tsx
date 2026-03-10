"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Download, PlugZap, RefreshCw, WifiOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PricingModal } from "@/components/dashboard/pricing-modal";
import { UNDERLYINGS } from "@/lib/constants";
import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { usePlanStore } from "@/store/plan-store";

interface CommandBarProps {
  expiries: string[];
  loadingExpiries: boolean;
}

interface ConnectPayload {
  connected: boolean;
  mode: "live" | "mock";
  message?: string;
}

function exportCsv(rows: ReturnType<typeof useMarketStore.getState>["rows"], symbol: string) {
  const header = "Strike,Call LTP,Call OI,Call Delta OI,Call IV,Put LTP,Put OI,Put Delta OI,Put IV";
  const lines = rows.map(
    (r) =>
      `${r.strike},${r.call.ltp},${r.call.oi},${r.call.deltaOi},${r.call.iv},${r.put.ltp},${r.put.oi},${r.put.deltaOi},${r.put.iv}`
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${symbol}-option-chain-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CommandBar({ expiries, loadingExpiries }: CommandBarProps) {
  const queryClient = useQueryClient();
  const { symbol, expiry, mode, connected, rows, setSymbol, setExpiry, setConnection } =
    useMarketStore();
  const { isFeatureLocked, incrementApiCalls } = usePlanStore();

  const [accessToken, setAccessToken] = useState("");

  const connectMutation = useMutation({
    mutationFn: async () => {
      incrementApiCalls();
      const response = await fetch("/api/session/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken })
      });

      if (!response.ok) {
        throw new Error(`Connect failed (${response.status})`);
      }

      return (await response.json()) as ConnectPayload;
    },
    onSuccess: (data) => {
      setConnection({ connected: data.connected, mode: data.mode });
      queryClient.invalidateQueries();
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/session/disconnect", { method: "POST" });
      if (!response.ok) {
        throw new Error("Disconnect failed");
      }
      return (await response.json()) as ConnectPayload;
    },
    onSuccess: (data) => {
      setConnection({ connected: data.connected, mode: data.mode });
      queryClient.invalidateQueries();
    }
  });

  const handleExport = () => {
    if (isFeatureLocked("export-csv")) return;
    exportCsv(rows, symbol);
  };

  return (
    <div className="rounded-xl border border-border/80 bg-panel/90 p-3 shadow-neon">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-2">
            {connected ? (
              <PlugZap className="h-4 w-4 text-bullish" />
            ) : (
              <WifiOff className="h-4 w-4 text-bearish" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mode
            </span>
            <span className={mode === "live" ? "text-bullish" : "text-warning"}>
              {mode.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-2">
            <Activity className="h-4 w-4 text-bullish" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Connection
            </span>
            <span className={connected ? "text-bullish" : "text-warning"}>
              {connected ? "AUTH OK" : "SIM MODE"}
            </span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-4 lg:max-w-3xl">
          <Select
            value={symbol}
            onValueChange={(value) => setSymbol(value as SupportedSymbol)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select symbol" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(UNDERLYINGS).map((underlying) => (
                <SelectItem key={underlying.symbol} value={underlying.symbol}>
                  {underlying.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={expiry}
            onValueChange={setExpiry}
            disabled={loadingExpiries || expiries.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingExpiries ? "Loading expiries" : "Select expiry"}
              />
            </SelectTrigger>
            <SelectContent>
              {expiries.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {isFeatureLocked("export-csv") ? (
              <PricingModal>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </PricingModal>
            ) : (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Connect</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect Upstox</DialogTitle>
                  <DialogDescription>
                    Access tokens are stored only in encrypted HttpOnly session cookies.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="upstox-token">Access Token</Label>
                    <Input
                      id="upstox-token"
                      value={accessToken}
                      onChange={(event) => setAccessToken(event.target.value)}
                      placeholder="Paste Upstox access token"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending || !accessToken}
                    >
                      {connectMutation.isPending
                        ? "Validating..."
                        : "Validate & Connect"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                    >
                      Disconnect
                    </Button>
                  </div>

                  {connectMutation.data?.message ? (
                    <p className="text-xs text-warning">{connectMutation.data.message}</p>
                  ) : null}

                  {connectMutation.error ? (
                    <p className="text-xs text-bearish">
                      {(connectMutation.error as Error).message}
                    </p>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
            <PricingModal />
          </div>
        </div>
      </div>
    </div>
  );
}
