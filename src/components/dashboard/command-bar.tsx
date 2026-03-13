"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Download,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  WifiOff
} from "lucide-react";
import { useState } from "react";

import { PricingModal } from "@/components/dashboard/pricing-modal";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { UNDERLYINGS } from "@/lib/constants";
import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";
import { usePlanStore } from "@/store/plan-store";

interface CommandBarProps {
  expiries: string[];
  loadingExpiries: boolean;
}

interface SessionPayload {
  connected: boolean;
  mode: "live" | "mock";
  message?: string;
  source?: "session" | "runtime" | "env" | "none";
  expiresAt?: string;
  approvalRequired?: boolean;
  tokenRequestAvailable?: boolean;
  oauthAvailable?: boolean;
  adminUnlocked?: boolean;
}

interface TokenRequestPayload {
  requested: boolean;
  authorizationExpiry?: string;
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

async function readApiMessage(response: Response, fallback: string) {
  let message = fallback;

  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) {
      message = payload.message;
    }
  } catch {
    // no-op
  }

  return message;
}

export function CommandBar({ expiries, loadingExpiries }: CommandBarProps) {
  const queryClient = useQueryClient();
  const {
    symbol,
    expiry,
    mode,
    connected,
    degraded,
    message,
    approvalRequired,
    tokenRequestAvailable,
    oauthAvailable,
    adminUnlocked,
    source,
    expiresAt,
    replayActive,
    replayFrameLabel,
    rows,
    setSymbol,
    setExpiry,
    setConnection
  } = useMarketStore();
  const { isFeatureLocked, incrementApiCalls } = usePlanStore();

  const [accessToken, setAccessToken] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const oauthLoginHref = "/api/upstox/login?returnTo=/";

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: adminSecret })
      });

      if (!response.ok) {
        throw new Error(await readApiMessage(response, `Unlock failed (${response.status})`));
      }

      return (await response.json()) as SessionPayload;
    },
    onSuccess: (data) => {
      setConnection(data);
      setAdminSecret("");
      void queryClient.invalidateQueries();
    }
  });

  const adminLogoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "Operator logout failed"));
      }
      return (await response.json()) as SessionPayload;
    },
    onSuccess: (data) => {
      setConnection(data);
      setDialogOpen(false);
      void queryClient.invalidateQueries();
    }
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      incrementApiCalls();
      const response = await fetch("/api/session/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken })
      });

      if (!response.ok) {
        throw new Error(await readApiMessage(response, `Connect failed (${response.status})`));
      }

      return (await response.json()) as SessionPayload;
    },
    onSuccess: (data) => {
      setConnection(data);
      void queryClient.invalidateQueries();
    }
  });

  const tokenRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/upstox/token-request", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(
          await readApiMessage(response, `Token request failed (${response.status})`)
        );
      }

      return (await response.json()) as TokenRequestPayload;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session-status"] });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/session/disconnect", { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "Disconnect failed"));
      }
      return (await response.json()) as SessionPayload;
    },
    onSuccess: (data) => {
      setConnection(data);
      void queryClient.invalidateQueries();
    }
  });

  const handleExport = () => {
    if (isFeatureLocked("export-csv")) {
      return;
    }

    exportCsv(rows, symbol);
  };

  const modeTone =
    replayActive || approvalRequired || mode === "mock" || degraded
      ? "text-warning"
      : "text-bullish";
  const connectionTone =
    replayActive || approvalRequired || mode === "mock" || degraded
      ? "text-warning"
      : "text-bullish";
  const connectionLabel =
    replayActive
      ? "REPLAY ACTIVE"
      : approvalRequired
        ? "APPROVAL REQUIRED"
        : mode === "mock"
          ? "SIM MODE"
          : degraded
            ? "LIVE DEGRADED"
            : connected
              ? "AUTH OK"
              : "DISCONNECTED";

  const operatorButtonLabel = adminUnlocked ? "Operator" : "Unlock";

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
            <span className={modeTone}>{mode.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-2">
            <Activity className="h-4 w-4 text-bullish" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Connection
            </span>
            <span className={connectionTone}>{connectionLabel}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-2">
            {adminUnlocked ? (
              <ShieldCheck className="h-4 w-4 text-bullish" />
            ) : (
              <ShieldOff className="h-4 w-4 text-warning" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operator
            </span>
            <span className={adminUnlocked ? "text-bullish" : "text-warning"}>
              {adminUnlocked ? "UNLOCKED" : "LOCKED"}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Source
            </span>
            <span className="text-xs uppercase tracking-wide text-foreground">
              {(source ?? "none").toUpperCase()}
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">{operatorButtonLabel}</Button>
              </DialogTrigger>
              <DialogContent>
                {!adminUnlocked ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Operator Unlock</DialogTitle>
                      <DialogDescription>
                        Live token controls are restricted to the operator session.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="operator-secret">Admin Secret</Label>
                        <Input
                          id="operator-secret"
                          type="password"
                          value={adminSecret}
                          onChange={(event) => setAdminSecret(event.target.value)}
                          placeholder="Enter operator admin secret"
                        />
                      </div>

                      <Button
                        onClick={() => unlockMutation.mutate()}
                        disabled={unlockMutation.isPending || adminSecret.length < 16}
                      >
                        {unlockMutation.isPending ? "Unlocking..." : "Unlock Operator"}
                      </Button>

                      {unlockMutation.error ? (
                        <p className="text-xs text-bearish">
                          {(unlockMutation.error as Error).message}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Operator Controls</DialogTitle>
                      <DialogDescription>
                        Manual live-token actions are limited to the unlocked operator
                        session. Runtime tokens may also be stored in the server-side
                        runtime store when enabled.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-border/80 bg-background/60 p-3">
                        <p className="text-sm font-medium text-foreground">
                          Preferred login
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Redirect through Upstox OAuth and bind the live token to the
                          configured operator account.
                        </p>
                        <a
                          href={oauthLoginHref}
                          className={buttonVariants({ className: "mt-3" })}
                        >
                          Continue with Upstox
                        </a>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="upstox-token">Access Token</Label>
                        <Input
                          id="upstox-token"
                          value={accessToken}
                          onChange={(event) => setAccessToken(event.target.value)}
                          placeholder="Paste Upstox access token"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
                        <Button
                          variant="outline"
                          onClick={() => adminLogoutMutation.mutate()}
                          disabled={adminLogoutMutation.isPending}
                        >
                          {adminLogoutMutation.isPending ? "Locking..." : "Lock Operator"}
                        </Button>
                      </div>

                      {connectMutation.error ? (
                        <p className="text-xs text-bearish">
                          {(connectMutation.error as Error).message}
                        </p>
                      ) : null}

                      {disconnectMutation.error ? (
                        <p className="text-xs text-bearish">
                          {(disconnectMutation.error as Error).message}
                        </p>
                      ) : null}

                      {adminLogoutMutation.error ? (
                        <p className="text-xs text-bearish">
                          {(adminLogoutMutation.error as Error).message}
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
            <PricingModal />
          </div>
        </div>
      </div>
      {message || replayFrameLabel || approvalRequired || tokenRequestMutation.data ? (
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <p className="text-warning">
            {replayActive && replayFrameLabel
              ? `Replaying local cache frame ${replayFrameLabel}.`
              : message ?? (approvalRequired
                  ? "Upstox approval is required for a fresh live token."
                  : "")}
          </p>

          {approvalRequired ? (
            <div className="flex flex-wrap items-center gap-2">
              {adminUnlocked ? (
                tokenRequestAvailable ? (
                  <Button
                    size="sm"
                    onClick={() => tokenRequestMutation.mutate()}
                    disabled={tokenRequestMutation.isPending}
                  >
                    {tokenRequestMutation.isPending
                      ? "Requesting approval..."
                      : "Approve Upstox Session"}
                  </Button>
                ) : oauthAvailable ? (
                  <a
                    href={oauthLoginHref}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Continue with Upstox
                  </a>
                ) : null
              ) : (
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                  Unlock Operator
                </Button>
              )}

              {expiresAt ? (
                <span className="text-muted-foreground">
                  Last token expiry: {new Date(expiresAt).toLocaleString("en-IN")}
                </span>
              ) : null}
            </div>
          ) : null}

          {tokenRequestMutation.data ? (
            <p className="text-bullish">
              Approval request sent.
              {tokenRequestMutation.data.authorizationExpiry
                ? ` Approve before ${new Date(
                    tokenRequestMutation.data.authorizationExpiry
                  ).toLocaleString("en-IN")}.`
                : ""}
            </p>
          ) : null}

          {tokenRequestMutation.error ? (
            <p className="text-bearish">
              {(tokenRequestMutation.error as Error).message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
