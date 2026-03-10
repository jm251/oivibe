"use client";

import { BarChart3, Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PricingModal } from "@/components/dashboard/pricing-modal";
import { usePlanStore } from "@/store/plan-store";

export function UsageBanner() {
  const { tier, apiCallsToday, apiCallsLimit, expiresAt } = usePlanStore();

  const usagePct = Math.min(100, (apiCallsToday / apiCallsLimit) * 100);
  const isNearLimit = usagePct > 80;

  return (
    <div className="rounded-xl border border-border/80 bg-panel/90 p-3 shadow-neon">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plan
            </span>
            <Badge
              variant={tier === "free" ? "secondary" : tier === "pro" ? "bullish" : "default"}
            >
              {tier.toUpperCase()}
            </Badge>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">API Calls:</span>
            <span className={isNearLimit ? "text-warning" : "text-foreground"}>
              {apiCallsToday.toLocaleString()} / {apiCallsLimit.toLocaleString()}
            </span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${
                  isNearLimit ? "bg-warning" : "bg-bullish"
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>

          {expiresAt && (
            <>
              <div className="hidden h-4 w-px bg-border sm:block" />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Expires: {new Date(expiresAt).toLocaleDateString("en-IN")}
              </span>
            </>
          )}
        </div>

        {tier === "free" && (
          <PricingModal>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-bullish/15 px-3 py-1.5 text-xs font-medium text-bullish transition-colors hover:bg-bullish/25"
            >
              <Crown className="h-3.5 w-3.5" />
              Upgrade to Pro
            </button>
          </PricingModal>
        )}
      </div>
    </div>
  );
}
