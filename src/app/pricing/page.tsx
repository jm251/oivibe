"use client";

import { Check, Crown, Rocket, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanTier, usePlanStore } from "@/store/plan-store";
import { Providers } from "@/components/providers";

const PLANS = [
  {
    tier: "free" as PlanTier,
    name: "Starter",
    price: "0",
    period: "forever",
    icon: Zap,
    color: "text-muted-foreground",
    features: [
      "Mock data simulator",
      "OI Heatmap (top 10 strikes)",
      "Call vs Put flow analysis",
      "Basic spot & OI timeline charts",
      "50 API calls/day"
    ],
    excluded: [
      "Strategy Lab",
      "3D Volatility Surface",
      "Full option chain grid",
      "Live Upstox data",
      "CSV data export"
    ]
  },
  {
    tier: "pro" as PlanTier,
    name: "Pro Trader",
    price: "999",
    period: "/month",
    icon: Rocket,
    popular: true,
    color: "text-bullish",
    features: [
      "Everything in Starter",
      "Strategy Lab with payoff & Greeks",
      "3D Volatility Surface",
      "Full option chain grid",
      "Live Upstox data connection",
      "CSV data export",
      "5,000 API calls/day",
      "Priority email support"
    ],
    excluded: ["Multi-symbol tracking", "Real-time alerts", "Team access"]
  },
  {
    tier: "enterprise" as PlanTier,
    name: "Enterprise",
    price: "4,999",
    period: "/month",
    icon: Crown,
    color: "text-warning",
    features: [
      "Everything in Pro",
      "Multi-symbol tracking",
      "Real-time price & OI alerts",
      "Unlimited API calls",
      "Dedicated support",
      "Custom integrations",
      "Team access (5 seats)",
      "White-label option"
    ],
    excluded: []
  }
];

function PricingContent() {
  const { tier: currentTier, setTier } = usePlanStore();
  const [processing, setProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState<PlanTier | null>(null);
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [success, setSuccess] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (showPayment) setTier(showPayment);
    setProcessing(false);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setShowPayment(null);
    }, 3000);
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="mb-12 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-bullish">OI VIBE Pricing</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Trade Smarter, Not Harder
        </h1>
        <p className="mt-3 text-muted-foreground">
          Choose the plan that fits your trading style. Upgrade or downgrade anytime.
        </p>
      </div>

      {success && (
        <div className="mb-8 flex items-center justify-center gap-2 rounded-lg bg-bullish/15 p-4 text-bullish">
          <Check className="h-5 w-5" />
          <span className="font-medium">Payment successful! Your plan is now active.</span>
        </div>
      )}

      {showPayment ? (
        <div className="mx-auto max-w-md space-y-6 rounded-xl border border-border p-6">
          <div>
            <h2 className="text-lg font-semibold">Complete Payment</h2>
            <p className="text-sm text-muted-foreground">
              Upgrading to {PLANS.find((p) => p.tier === showPayment)?.name}
            </p>
            <p className="mt-2 text-3xl font-bold text-bullish">
              INR {PLANS.find((p) => p.tier === showPayment)?.price}
              <span className="text-base font-normal text-muted-foreground">
                {PLANS.find((p) => p.tier === showPayment)?.period}
              </span>
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Card Number</Label>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Expiry</Label>
                <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>CVV</Label>
                <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} type="password" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handlePayment} disabled={processing}>
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
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentTier === plan.tier;

            return (
              <div
                key={plan.tier}
                className={`relative flex flex-col rounded-xl border p-6 ${
                  plan.popular ? "border-bullish/50 shadow-neon" : "border-border/80"
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-bullish text-primary-foreground">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-4 flex items-center gap-2">
                  <Icon className={`h-6 w-6 ${plan.color}`} />
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                </div>

                <p className="mb-6">
                  <span className="text-3xl font-bold">INR {plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </p>

                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-bullish" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.excluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground/50">
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-center">-</span>
                      <span className="line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : plan.popular ? "default" : "outline"}
                  disabled={isCurrent}
                  onClick={() =>
                    plan.tier === "free" ? setTier("free") : setShowPayment(plan.tier)
                  }
                >
                  {isCurrent ? "Current Plan" : plan.tier === "free" ? "Downgrade" : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-16 text-center">
        <h2 className="mb-4 text-xl font-semibold">Frequently Asked Questions</h2>
        <div className="mx-auto grid max-w-3xl gap-4 text-left md:grid-cols-2">
          <div className="rounded-lg border border-border/80 p-4">
            <p className="font-medium">Can I cancel anytime?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Yes, you can downgrade to the free plan at any time. No questions asked.
            </p>
          </div>
          <div className="rounded-lg border border-border/80 p-4">
            <p className="font-medium">Do I need an Upstox account?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No. The free plan works with simulated data. You only need Upstox for live data (Pro+).
            </p>
          </div>
          <div className="rounded-lg border border-border/80 p-4">
            <p className="font-medium">What payment methods are accepted?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We accept all major credit/debit cards, UPI, and net banking via Razorpay.
            </p>
          </div>
          <div className="rounded-lg border border-border/80 p-4">
            <p className="font-medium">Is there a refund policy?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Yes, 7-day money-back guarantee on all paid plans.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Providers>
      <PricingContent />
    </Providers>
  );
}
