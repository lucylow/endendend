import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import {
  TASHI_STAKING,
  illustrativeApyPercentForStake,
  stakingTiersForDocs,
} from "@/lib/monetization";

export function APYCalculator() {
  const [stakeAmount, setStakeAmount] = useState(10_000);
  const [durationMonths, setDurationMonths] = useState(12);

  const currentAPY = illustrativeApyPercentForStake(stakeAmount);
  const monthlyReward = useMemo(
    () => (stakeAmount * currentAPY) / 100 / 12,
    [stakeAmount, currentAPY],
  );
  const yearlyReward = useMemo(() => (stakeAmount * currentAPY) / 100, [stakeAmount, currentAPY]);
  const linearProjection = useMemo(
    () => (stakeAmount * currentAPY * (durationMonths / 12)) / 100,
    [stakeAmount, currentAPY, durationMonths],
  );

  return (
    <Card className="border-border bg-card/40">
      <CardHeader>
        <CardTitle>ROI calculator</CardTitle>
        <p className="text-sm text-muted-foreground">
          Illustrative yield by stake tier (not guaranteed). Network distributes{" "}
          {(TASHI_STAKING.operatorShareOfFeePool * 100).toFixed(0)}% of coordination + settlement fees to the operator
          pool; your share is stake-weighted with uptime bonuses above {(TASHI_STAKING.highAvailabilityThreshold * 100).toFixed(1)}%
          availability.
        </p>
        <p className="text-xs text-muted-foreground">
          Tiers:{" "}
          {stakingTiersForDocs()
            .map((t) => `${t.minTashi.toLocaleString()}+ $TASHI → ${t.illustrativeApyPercent}% APY`)
            .join(" · ")}
          . Below {TASHI_STAKING.minStakeTashi.toLocaleString()} $TASHI shows 0% (not eligible).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground/90">Stake amount ($TASHI)</label>
          <Input
            type="number"
            min={0}
            value={stakeAmount}
            onChange={(e) => setStakeAmount(Number(e.target.value))}
            className="text-right font-mono"
            placeholder="10000"
          />
          <Slider
            value={[Math.min(stakeAmount, 500_000)]}
            onValueChange={([v]) => setStakeAmount(v)}
            max={500_000}
            step={1000}
            className="mt-3 w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground/90">Duration (months)</label>
          <Slider
            value={[durationMonths]}
            onValueChange={([v]) => setDurationMonths(v)}
            min={1}
            max={36}
            step={1}
            className="w-full"
          />
          <p className="mt-1 text-right font-mono text-xs text-muted-foreground">{durationMonths} mo</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-gradient-to-r from-zinc-950/50 to-zinc-900/40 p-6 text-center ring-1 ring-border/50">
          <div>
            <div className="font-mono text-3xl font-black text-emerald-400">
              {monthlyReward.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-muted-foreground">Monthly (linear)</p>
          </div>
          <div>
            <div className="font-mono text-3xl font-black text-cyan-400">
              {yearlyReward.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-muted-foreground">Yearly (linear)</p>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            Stake: <span className="font-mono text-foreground">{stakeAmount.toLocaleString()}</span> $TASHI
          </div>
          <div>
            Illustrative APY: <span className="font-bold text-emerald-400">{currentAPY}%</span>
            {stakeAmount > 0 && stakeAmount < TASHI_STAKING.minStakeTashi && (
              <span className="ml-2 text-amber-200/90">— stake at least {TASHI_STAKING.minStakeTashi.toLocaleString()} to earn</span>
            )}
          </div>
          <div>
            Simple ROI over {durationMonths} mo:{" "}
            <span className="font-bold text-cyan-400">
              {linearProjection.toLocaleString(undefined, { maximumFractionDigits: 2 })} $TASHI
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
