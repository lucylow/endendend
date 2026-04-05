import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TASHI_STAKING, estimateEpochStakerRewardUsd, stakingTiersForDocs } from "@/lib/monetization";
import { GitBranch, Shield } from "lucide-react";

const FLYWHEEL_STEPS = [
  "Swarm operators stake $TASHI → priority queue + fee discounts on coordination",
  "Daily epoch: coordination minutes + settlement fees → operator reward pool",
  `Stakers earn pro-rata share (${(TASHI_STAKING.operatorShareOfFeePool * 100).toFixed(0)}% of fees) weighted by stake + uptime`,
  "99.9%+ availability boosts rewards; missed consensus windows reduce payout (slashing policy)",
];

export function SwarmRewardsMechanism() {
  const exampleReward = estimateEpochStakerRewardUsd({
    totalFeesUsd: 700_000 / 30,
    stakedTashi: 100_000,
    totalStakedTashi: 50_000_000,
    availability01: 0.9995,
    missedConsensusWindows: 0,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border bg-card/40 ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-cyan-400" />
            Swarm rewards flywheel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            {FLYWHEEL_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
            Example (illustrative): ~${(700_000 / 30).toLocaleString("en-US", { maximumFractionDigits: 0 })} daily fees
            (from ~$700K MRR network), 100K $TASHI stake / 50M $TASHI TVL, 99.95% uptime → ~$
            {exampleReward.toLocaleString("en-US", { maximumFractionDigits: 0 })} / day epoch to this operator before
            compounding — not a forecast.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/40 ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-amber-400" />
            Stake tiers (swarm)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Stake</th>
                <th className="py-2 pr-3 font-medium">Priority</th>
                <th className="py-2 pr-3 font-medium">Coord. discount</th>
                <th className="py-2 pr-3 font-medium">Tier reward bonus</th>
                <th className="py-2 font-medium">Slash risk</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {stakingTiersForDocs()
                .slice()
                .reverse()
                .map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono">{t.minTashi.toLocaleString()}+</td>
                    <td className="py-2 pr-3">{t.priorityLabel}</td>
                    <td className="py-2 pr-3 font-mono">{(t.feeDiscount * 100).toFixed(0)}%</td>
                    <td className="py-2 pr-3 font-mono">+{(t.tierRewardBonus * 100).toFixed(0)}%</td>
                    <td className="py-2 capitalize text-muted-foreground">{t.slashingRiskLabel}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            On top of tier bonus, meeting {(TASHI_STAKING.highAvailabilityThreshold * 100).toFixed(1)}% availability adds
            another +{(TASHI_STAKING.highAvailabilityRewardBonus * 100).toFixed(0)}% to epoch rewards. Non-stakers pay
            full coordination fees and do not receive pool distributions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
