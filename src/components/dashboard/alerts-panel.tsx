"use client";

import { Bell, BellRing, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OptionChainRow, ChainAggregates } from "@/lib/types";

type AlertCondition = "oi-above" | "oi-below" | "iv-above" | "iv-below" | "pcr-above" | "pcr-below" | "spot-above" | "spot-below";

interface AlertRule {
  id: string;
  condition: AlertCondition;
  strike?: number;
  optionType?: "CALL" | "PUT";
  threshold: number;
  label: string;
  active: boolean;
}

interface TriggeredAlert {
  id: string;
  ruleId: string;
  label: string;
  message: string;
  timestamp: string;
  type: "bullish" | "bearish" | "info";
}

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: "oi-above", label: "OI Crosses Above" },
  { value: "oi-below", label: "OI Drops Below" },
  { value: "iv-above", label: "IV Goes Above" },
  { value: "iv-below", label: "IV Goes Below" },
  { value: "pcr-above", label: "PCR Above" },
  { value: "pcr-below", label: "PCR Below" },
  { value: "spot-above", label: "Spot Above" },
  { value: "spot-below", label: "Spot Below" }
];

function checkAlerts(
  rules: AlertRule[],
  rows: OptionChainRow[],
  aggregates: ChainAggregates,
  spot: number,
  firedSet: Set<string>
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];

  for (const rule of rules) {
    if (!rule.active || firedSet.has(rule.id)) continue;

    let shouldFire = false;
    let message = "";
    let type: "bullish" | "bearish" | "info" = "info";

    if (rule.condition === "pcr-above" && aggregates.pcrOi > rule.threshold) {
      shouldFire = true;
      message = `PCR(OI) = ${aggregates.pcrOi.toFixed(2)} crossed above ${rule.threshold}`;
      type = "bullish";
    } else if (rule.condition === "pcr-below" && aggregates.pcrOi < rule.threshold) {
      shouldFire = true;
      message = `PCR(OI) = ${aggregates.pcrOi.toFixed(2)} dropped below ${rule.threshold}`;
      type = "bearish";
    } else if (rule.condition === "spot-above" && spot > rule.threshold) {
      shouldFire = true;
      message = `Spot ${spot.toFixed(2)} crossed above ${rule.threshold}`;
      type = "bullish";
    } else if (rule.condition === "spot-below" && spot < rule.threshold) {
      shouldFire = true;
      message = `Spot ${spot.toFixed(2)} dropped below ${rule.threshold}`;
      type = "bearish";
    } else if (rule.strike && (rule.condition === "oi-above" || rule.condition === "oi-below")) {
      const row = rows.find((r) => r.strike === rule.strike);
      if (row) {
        const leg = rule.optionType === "PUT" ? row.put : row.call;
        if (rule.condition === "oi-above" && leg.oi > rule.threshold) {
          shouldFire = true;
          message = `${rule.strike} ${rule.optionType} OI = ${leg.oi.toLocaleString("en-IN")} crossed ${rule.threshold.toLocaleString("en-IN")}`;
          type = rule.optionType === "CALL" ? "bearish" : "bullish";
        } else if (rule.condition === "oi-below" && leg.oi < rule.threshold) {
          shouldFire = true;
          message = `${rule.strike} ${rule.optionType} OI = ${leg.oi.toLocaleString("en-IN")} dropped below ${rule.threshold.toLocaleString("en-IN")}`;
          type = "info";
        }
      }
    } else if (rule.strike && (rule.condition === "iv-above" || rule.condition === "iv-below")) {
      const row = rows.find((r) => r.strike === rule.strike);
      if (row) {
        const leg = rule.optionType === "PUT" ? row.put : row.call;
        if (rule.condition === "iv-above" && leg.iv > rule.threshold) {
          shouldFire = true;
          message = `${rule.strike} ${rule.optionType} IV = ${leg.iv.toFixed(2)}% crossed ${rule.threshold}%`;
          type = "bearish";
        } else if (rule.condition === "iv-below" && leg.iv < rule.threshold) {
          shouldFire = true;
          message = `${rule.strike} ${rule.optionType} IV = ${leg.iv.toFixed(2)}% dropped below ${rule.threshold}%`;
          type = "bullish";
        }
      }
    }

    if (shouldFire) {
      firedSet.add(rule.id);
      triggered.push({
        id: `${rule.id}-${Date.now()}`,
        ruleId: rule.id,
        label: rule.label,
        message,
        timestamp: new Date().toISOString(),
        type
      });
    }
  }

  return triggered;
}

export function AlertsPanel({
  rows,
  aggregates,
  spot
}: {
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
  spot: number;
}) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<TriggeredAlert[]>([]);
  const firedRef = useRef(new Set<string>());

  // New rule form state
  const [condition, setCondition] = useState<AlertCondition>("pcr-above");
  const [strike, setStrike] = useState("");
  const [optionType, setOptionType] = useState<"CALL" | "PUT">("CALL");
  const [threshold, setThreshold] = useState("");

  const needsStrike = condition.startsWith("oi-") || condition.startsWith("iv-");

  const addRule = useCallback(() => {
    const th = Number(threshold);
    if (!Number.isFinite(th)) return;

    const rule: AlertRule = {
      id: crypto.randomUUID(),
      condition,
      strike: needsStrike ? Number(strike) || undefined : undefined,
      optionType: needsStrike ? optionType : undefined,
      threshold: th,
      label: `${CONDITIONS.find((c) => c.value === condition)?.label ?? condition} ${th}${needsStrike ? ` @ ${strike} ${optionType}` : ""}`,
      active: true
    };

    setRules((prev) => [...prev, rule]);
    setThreshold("");
    setStrike("");
  }, [condition, strike, optionType, threshold, needsStrike]);

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    firedRef.current.delete(id);
  };

  // Check alerts on data changes
  useEffect(() => {
    if (!rules.length || !rows.length) return;

    const newAlerts = checkAlerts(rules, rows, aggregates, spot, firedRef.current);
    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 50));

      // Browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        for (const alert of newAlerts) {
          new Notification(`OI VIBE Alert: ${alert.label}`, { body: alert.message });
        }
      }
    }
  }, [rules, rows, aggregates, spot]);

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-warning" />
            Smart Alerts
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="default">{rules.length} Rules</Badge>
            {alerts.length > 0 && (
              <Badge variant="warning">
                <BellRing className="mr-1 h-3 w-3" />
                {alerts.length}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add rule form */}
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/70 bg-background/40 p-2">
          <div className="min-w-[140px]">
            <p className="mb-1 text-[9px] uppercase text-muted-foreground">Condition</p>
            <Select value={condition} onValueChange={(v) => setCondition(v as AlertCondition)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsStrike && (
            <>
              <div className="w-20">
                <p className="mb-1 text-[9px] uppercase text-muted-foreground">Strike</p>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  placeholder="22500"
                />
              </div>
              <div className="w-20">
                <p className="mb-1 text-[9px] uppercase text-muted-foreground">Type</p>
                <Select value={optionType} onValueChange={(v) => setOptionType(v as "CALL" | "PUT")}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALL">CE</SelectItem>
                    <SelectItem value="PUT">PE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="w-24">
            <p className="mb-1 text-[9px] uppercase text-muted-foreground">Threshold</p>
            <Input
              className="h-8 text-xs"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="1.2"
            />
          </div>

          <Button size="sm" className="h-8" onClick={addRule} disabled={!threshold}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={requestNotificationPermission}>
            <Bell className="mr-1 h-3 w-3" /> Enable Notifications
          </Button>
        </div>

        {/* Active rules */}
        {rules.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Active Rules</p>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2 py-1 text-xs"
              >
                <span>{rule.label}</span>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="text-muted-foreground hover:text-bearish"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Triggered alerts */}
        <ScrollArea className="h-[160px]">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Alert History
            </p>
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-md border px-2 py-1.5 text-xs ${
                    alert.type === "bullish"
                      ? "border-bullish/30 bg-bullish/5"
                      : alert.type === "bearish"
                        ? "border-bearish/30 bg-bearish/5"
                        : "border-border/50 bg-background/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{alert.label}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString("en-IN")}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{alert.message}</p>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No alerts triggered yet. Add rules above to start monitoring.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
