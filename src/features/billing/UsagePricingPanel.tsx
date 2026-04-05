import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBilling } from "@/features/billing/useBilling";
import {
  MONETIZATION,
  MONETIZATION_SECURITY,
  agentQuotaLabel,
  applyStakingDiscountToUsd,
  coordinationListUsd,
  creditsForUsage,
  feeDiscountRateForStakeTashi,
  premiumAddOnUsd,
  roundUsd4,
  settlementFeeUsd,
  settlementRequiresMultiSig,
  swarmStakeTier,
  tokenPaymentUsdEquivalent,
  type PremiumAddOn,
} from "@/lib/monetization";
import { Gauge, Landmark, Sparkles, Layers } from "lucide-react";

const ADD_ONS: { id: PremiumAddOn; label: string }[] = [
  { id: "missionReplay", label: "Mission replay & audit export" },
  { id: "predictiveCoordination", label: "Predictive handoff (ML-assisted)" },
  { id: "multiModal", label: "Multi-modal pack" },
];

const STAKE_PRESETS: { label: string; tashi: number }[] = [
  { label: "No $TASHI stake", tashi: 0 },
  { label: "10,000 $TASHI (Standard · 20% off coord.)", tashi: 10_000 },
  { label: "50,000 $TASHI (High · 30% off)", tashi: 50_000 },
  { label: "100,000 $TASHI (Mission-critical · 50% off)", tashi: 100_000 },
];

export function UsagePricingPanel() {
  const { currentTier } = useBilling();
  const [agentMinutes, setAgentMinutes] = useState(300);
  const [dealUsd, setDealUsd] = useState(1000);
  const [payWithTct, setPayWithTct] = useState(false);
  const [stakeTashi, setStakeTashi] = useState(0);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<PremiumAddOn, boolean>>({
    missionReplay: false,
    predictiveCoordination: false,
    multiModal: false,
  });

  const stakeTierInfo = useMemo(() => swarmStakeTier(stakeTashi), [stakeTashi]);

  const breakdown = useMemo(() => {
    const coordList = coordinationListUsd(agentMinutes);
    const coordAfterToken = payWithTct ? tokenPaymentUsdEquivalent(coordList) : coordList;
    const stakeDiscountRate = feeDiscountRateForStakeTashi(stakeTashi);
    const coordCharge = applyStakingDiscountToUsd(coordAfterToken, stakeDiscountRate);
    const settle = settlementFeeUsd(dealUsd);
    const addOnTotal = ADD_ONS.filter((a) => selectedAddOns[a.id]).reduce(
      (s, a) => s + premiumAddOnUsd(a.id),
      0,
    );
    const subtotal = roundUsd4(coordCharge + settle + addOnTotal);
    const credits = roundUsd4(creditsForUsage(coordList, currentTier) + creditsForUsage(settle, currentTier));
    return {
      coordList,
      coordAfterToken,
      stakeDiscountRate,
      coordCharge,
      settle,
      addOnTotal,
      subtotal,
      credits,
    };
  }, [agentMinutes, dealUsd, payWithTct, selectedAddOns, currentTier, stakeTashi]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-foreground">Usage &amp; settlement (estimator)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Illustrative pay-as-you-go on top of your plan. Staked operators receive coordination fee discounts and
        pro-rata shares of the operator reward pool (see Staking dashboard). Subscription bundles can still include a
        coordination pool to avoid double charging.
      </p>

      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Payments:</span> Stripe Checkout and Elements use{" "}
          <span className="text-foreground">3D Secure</span> when regulations and risk engines require it. Policy line:
          document step-up authentication for card charges over{" "}
          <span className="font-mono text-foreground">${MONETIZATION_SECURITY.scaStepUpMinUsd}</span> where you commit
          to extra friction beyond Stripe defaults.
        </p>
        {MONETIZATION_SECURITY.settlementMultiSigThresholdUsd > 0 && (
          <p className="border-t border-border/50 pt-2">
            <span className="font-medium text-amber-200">Arc settlement control:</span> cleared notionals at or above{" "}
            <span className="font-mono text-foreground">
              ${MONETIZATION_SECURITY.settlementMultiSigThresholdUsd.toLocaleString("en-US")}
            </span>{" "}
            require <span className="text-foreground">2-of-3 operator multi-sig</span> before execution (see security
            checklist below).
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card/40 ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4 text-emerald-400" />
              Meters
            </CardTitle>
            <CardDescription>
              Coordination: ${MONETIZATION.coordinationUsdPerAgentMinute}/agent-minute · Settlement:{" "}
              {(MONETIZATION.settlementFeeRate * 100).toFixed(1)}% of cleared value · Permit TTL ~{" "}
              {MONETIZATION.coordinationPermitTtlMs}ms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="agent-minutes" className="text-muted-foreground">
                Agent-minutes (agents × minutes)
              </Label>
              <input
                id="agent-minutes"
                type="number"
                min={0}
                step={1}
                value={Number.isNaN(agentMinutes) ? "" : agentMinutes}
                onChange={(e) => setAgentMinutes(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="deal-usd" className="text-muted-foreground">
                Cleared deal value (USD)
              </Label>
              <input
                id="deal-usd"
                type="number"
                min={0}
                step={1}
                value={Number.isNaN(dealUsd) ? "" : dealUsd}
                onChange={(e) => setDealUsd(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Pay with TCT</p>
                <p className="text-xs text-muted-foreground">
                  {(100 - MONETIZATION.tctVsUsdMultiplier * 100).toFixed(0)}% off list coordination when settled in token
                </p>
              </div>
              <Switch checked={payWithTct} onCheckedChange={setPayWithTct} aria-label="Pay coordination with TCT" />
            </div>
            <div>
              <Label htmlFor="stake-preset" className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                $TASHI stake (swarm rewards tier)
              </Label>
              <select
                id="stake-preset"
                value={stakeTashi}
                onChange={(e) => setStakeTashi(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {STAKE_PRESETS.map((p) => (
                  <option key={p.tashi} value={p.tashi}>
                    {p.label}
                  </option>
                ))}
              </select>
              {stakeTierInfo && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Priority: <span className="font-medium text-foreground">{stakeTierInfo.priorityLabel}</span> · staking
                  discount applies to coordination meter only
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Your tier &amp; estimate
            </CardTitle>
            <CardDescription>
              Plan: <span className="font-semibold text-foreground">{currentTier}</span> · Agent ID quota:{" "}
              {agentQuotaLabel(currentTier)} · Credits multiplier ×{MONETIZATION.tierCreditMultipliers[currentTier]} on
              metered lines (internal accounting)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Coordination (list)</dt>
                <dd className="font-mono text-foreground">${breakdown.coordList.toFixed(4)}</dd>
              </div>
              {payWithTct && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {breakdown.stakeDiscountRate > 0 ? "After TCT settlement" : "Coordination (meter total)"}
                  </dt>
                  <dd className="font-mono text-emerald-300">${breakdown.coordAfterToken.toFixed(4)}</dd>
                </div>
              )}
              {breakdown.stakeDiscountRate > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    After $TASHI stake (−{(breakdown.stakeDiscountRate * 100).toFixed(0)}% on meter)
                  </dt>
                  <dd className="font-mono text-amber-200">${breakdown.coordCharge.toFixed(4)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Settlement fee</dt>
                <dd className="font-mono text-foreground">${breakdown.settle.toFixed(4)}</dd>
              </div>
              {breakdown.addOnTotal > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Add-ons (monthly)</dt>
                  <dd className="font-mono text-foreground">${breakdown.addOnTotal.toFixed(2)}</dd>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between gap-4 font-semibold">
                <dt className="text-foreground">Indicative subtotal</dt>
                <dd className="font-mono text-foreground">${breakdown.subtotal.toFixed(4)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                <dt>Credits (tier-weighted, coord + settlement)</dt>
                <dd className="font-mono">${breakdown.credits.toFixed(4)}</dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Premium add-ons</p>
              <ul className="space-y-2">
                {ADD_ONS.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`addon-${a.id}`}
                      checked={selectedAddOns[a.id]}
                      onChange={(e) =>
                        setSelectedAddOns((prev) => ({ ...prev, [a.id]: e.target.checked }))
                      }
                      className="rounded border-border"
                    />
                    <label htmlFor={`addon-${a.id}`} className="flex-1 cursor-pointer text-sm text-muted-foreground">
                      {a.label}{" "}
                      <span className="font-mono text-foreground">+${premiumAddOnUsd(a.id)}/mo</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
