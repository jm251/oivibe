"use client";

import { Crown, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PricingModal } from "@/components/dashboard/pricing-modal";
import { LockedFeature, usePlanStore } from "@/store/plan-store";

interface FeatureGateProps {
  feature: LockedFeature;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const FEATURE_LABELS: Record<LockedFeature, { plan: string; benefit: string }> = {
  "strategy-lab": {
    plan: "Pro",
    benefit: "Build & visualize multi-leg option strategies with real-time Greeks and payoff diagrams"
  },
  "vol-surface": {
    plan: "Pro",
    benefit: "Explore 3D implied volatility surfaces across strikes and expiries"
  },
  "full-chain": {
    plan: "Pro",
    benefit: "View the complete option chain with all strikes, LTP, OI, and delta OI data"
  },
  "live-data": {
    plan: "Pro",
    benefit: "Connect to Upstox for real-time market data feed"
  },
  "multi-symbol": {
    plan: "Enterprise",
    benefit: "Track NIFTY, BANKNIFTY, and FINNIFTY simultaneously in multiple tabs"
  },
  "export-csv": {
    plan: "Pro",
    benefit: "Export option chain snapshots and analytics as CSV for offline analysis"
  },
  alerts: {
    plan: "Enterprise",
    benefit: "Set custom alerts for OI walls, PCR shifts, and price levels"
  }
};

export function FeatureGate({ feature, title, description, children }: FeatureGateProps) {
  const isLocked = usePlanStore((s) => s.isFeatureLocked(feature));

  if (!isLocked) {
    return <>{children}</>;
  }

  const info = FEATURE_LABELS[feature];

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-border/80">
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15">
            <Lock className="h-6 w-6 text-warning" />
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="max-w-xs text-xs text-muted-foreground">
            {description ?? info.benefit}
          </p>
          <PricingModal>
            <Button size="sm" className="mt-1">
              <Crown className="mr-2 h-3.5 w-3.5" />
              Upgrade to {info.plan}
            </Button>
          </PricingModal>
        </div>
      </div>
      <div className="pointer-events-none h-full opacity-20 blur-sm">
        {children}
      </div>
    </div>
  );
}
