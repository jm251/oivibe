"use client";

import { Check, Crown, Rocket, Zap } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { PlanTier, usePlanStore } from "@/store/plan-store";

const PLANS = [
  {
    tier: "free" as PlanTier,
    name: "Free",
    price: "0",
    period: "forever",
    icon: Zap,
    features: [
      "Mock data simulator",
      "OI Heatmap (top 10 strikes)",
      "Call vs Put flow",
      "Basic charts",
      "50 API calls/day"
    ],
    excluded: [
      "Strategy Lab",
      "3D Vol Surface",
      "Full option chain",
      "Live Upstox data",
      "CSV export"
    ]
  },
  {
    tier: "pro" as PlanTier,
    name: "Pro",
    price: "999",
    period: "/month",
    icon: Rocket,
    popular: true,
    features: [
      "Everything in Free",
      "Strategy Lab (payoff + Greeks)",
      "3D Volatility Surface",
      "Full option chain grid",
      "Live Upstox data",
      "CSV data export",
      "5,000 API calls/day",
      "Priority support"
    ],
    excluded: ["Multi-symbol tracking", "Price alerts"]
  },
  {
    tier: "enterprise" as PlanTier,
    name: "Enterprise",
    price: "4,999",
    period: "/month",
    icon: Crown,
    features: [
      "Everything in Pro",
      "Multi-symbol tracking",
      "Real-time price alerts",
      "Unlimited API calls",
      "Dedicated support",
      "Custom integrations",
      "Team access (5 seats)"
    ],
    excluded: []
  }
];

export function PricingModal({ children }: { children?: React.ReactNode }) {
  const { tier: currentTier, setTier } = usePlanStore();
  const [processing, setProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState<PlanTier | null>(null);
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [open, setOpen] = useState(false);

  const handleUpgrade = (tier: PlanTier) => {
    if (tier === "free") {
      setTier("free");
      return;
    }
    setShowPayment(tier);
  };

  const handlePayment = async () => {
    setProcessing(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (showPayment) {
      setTier(showPayment);
    }
    setProcessing(false);
    setPaymentSuccess(true);
    setTimeout(() => {
      setPaymentSuccess(false);
      setShowPayment(null);
      setOpen(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Crown className="mr-2 h-4 w-4 text-warning" />
            Upgrade
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {showPayment ? "Complete Payment" : "Choose Your Plan"}
          </DialogTitle>
          <DialogDescription>
            {showPayment
              ? "Enter payment details to activate your subscription"
              : "Unlock premium trading intelligence features"}
          </DialogDescription>
        </DialogHeader>

        {paymentSuccess ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bullish/20">
              <Check className="h-8 w-8 text-bullish" />
            </div>
            <p className="text-lg font-semibold text-bullish">Payment Successful!</p>
            <p className="text-sm text-muted-foreground">Your plan has been upgraded.</p>
          </div>
        ) : showPayment ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <p className="text-sm text-muted-foreground">Upgrading to</p>
              <p className="text-lg font-semibold">
                {PLANS.find((p) => p.tier === showPayment)?.name} Plan
              </p>
              <p className="text-2xl font-bold text-bullish">
                INR {PLANS.find((p) => p.tier === showPayment)?.price}
                <span className="text-sm font-normal text-muted-foreground">
                  {PLANS.find((p) => p.tier === showPayment)?.period}
                </span>
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Card Number</Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Expiry</Label>
                  <Input
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CVV</Label>
                  <Input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="123"
                    type="password"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handlePayment}
                disabled={processing}
              >
                {processing ? "Processing..." : "Pay Now"}
              </Button>
              <Button variant="outline" onClick={() => setShowPayment(null)}>
                Back
              </Button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">
              Demo mode: No real charges. Pre-filled test card for preview.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isCurrent = currentTier === plan.tier;

              return (
                <div
                  key={plan.tier}
                  className={`relative rounded-xl border p-4 ${
                    plan.popular
                      ? "border-bullish/50 shadow-neon"
                      : "border-border/80"
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-bullish text-primary-foreground">
                      Most Popular
                    </Badge>
                  )}

                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-5 w-5 text-bullish" />
                    <h3 className="font-semibold">{plan.name}</h3>
                  </div>

                  <p className="mb-4">
                    <span className="text-2xl font-bold">INR {plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </p>

                  <ul className="mb-4 space-y-2 text-xs">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-bullish" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.excluded.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-muted-foreground/50">
                        <span className="mt-0.5 h-3 w-3 shrink-0 text-center">-</span>
                        <span className="line-through">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : plan.popular ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() => handleUpgrade(plan.tier)}
                  >
                    {isCurrent ? "Current Plan" : plan.tier === "free" ? "Downgrade" : "Upgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
