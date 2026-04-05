import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaking } from "@/features/staking/useStaking";
import { motion } from "framer-motion";
import { Award } from "lucide-react";

export function RewardsCard() {
  const {
    unclaimedRewards,
    totalRewardsEarned,
    apy,
    claimRewards,
    isClaiming,
    claimCooldown,
  } = useStaking();

  const hasRewards = unclaimedRewards > 0;

  return (
    <Card className="border-border bg-card/40 shadow-xl transition-all hover:shadow-cyan-500/10">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500">
            <Award className="h-6 w-6 text-zinc-950" />
          </div>
          <div>
            <CardTitle className="text-2xl">Rewards</CardTitle>
            <p className="text-sm text-muted-foreground">Up to 48% APY from network revenue (display rate)</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl bg-zinc-950/40 p-8 text-center ring-1 ring-border/60"
        >
          <div className="mb-2 font-mono text-4xl font-black text-yellow-400">
            {unclaimedRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <p className="mb-6 text-muted-foreground">Unclaimed rewards ($TASHI)</p>

          <Button
            onClick={() => void claimRewards()}
            disabled={!hasRewards || isClaiming || claimCooldown > 0}
            className="h-14 w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-xl font-bold shadow-lg hover:from-yellow-400 hover:to-orange-400"
          >
            {isClaiming ? "Claiming…" : `Claim ${unclaimedRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </Button>

          {claimCooldown > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Next claim in {claimCooldown}s</p>
          )}
        </motion.div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/20 p-4 text-center ring-1 ring-border/40">
          <div>
            <div className="font-mono text-2xl font-bold text-emerald-400">
              {totalRewardsEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-sm text-muted-foreground">Total earned</p>
          </div>
          <div>
            <div className="font-mono text-2xl font-bold text-cyan-400">{apy.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Current APY</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
