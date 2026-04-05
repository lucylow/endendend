import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaking } from "@/features/staking/useStaking";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ConnectWalletCTA } from "./ConnectWalletCTA";

function discountForAmount(amount: number): number {
  if (amount >= 100_000) return 50;
  if (amount >= 50_000) return 35;
  if (amount >= 10_000) return 20;
  if (amount >= 1_000) return 10;
  return 5;
}

export function StakeCard() {
  const {
    stakedBalance,
    isWalletConnected,
    stake,
    unstake,
    isStaking,
    isUnstaking,
    maxStake,
    walletBalance,
  } = useStaking();

  const [stakeAmount, setStakeAmount] = useState(0);
  const [unstakeAmount, setUnstakeAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  const maxForSlider = Math.max(maxStake || 10_000, 10_000);
  const progressPct = useMemo(() => {
    const cap = maxStake || 1;
    const pct = (stakedBalance / cap) * 100;
    return Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  }, [stakedBalance, maxStake]);

  const handleStake = async () => {
    await stake(stakeAmount);
    setStakeAmount(0);
  };

  const handleUnstake = async () => {
    await unstake(unstakeAmount);
    setUnstakeAmount(0);
  };

  return (
    <Card className="border-border bg-card/40 shadow-xl transition-all duration-500 hover:shadow-emerald-500/10 lg:col-span-1">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Zap className="h-8 w-8 text-emerald-400" />
          Stake $TASHI
        </CardTitle>
        <CardDescription>Lock $TASHI for priority access and rewards</CardDescription>
      </CardHeader>

      {!isWalletConnected ? (
        <CardContent className="pb-6">
          <ConnectWalletCTA />
        </CardContent>
      ) : (
        <>
          <div className="border-b border-border px-6 pb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground">Staked balance</span>
              <span className="font-mono text-2xl font-bold text-foreground">
                {stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $TASHI
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="mt-1 text-xs text-muted-foreground">{progressPct.toFixed(1)}% of max priority cap</p>
          </div>

          <CardContent className="space-y-6 p-6">
            <div className="flex space-x-2 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("stake")}
                className={`px-4 pb-3 font-medium transition-all ${
                  activeTab === "stake"
                    ? "border-b-2 border-emerald-500 text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Stake
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unstake")}
                className={`px-4 pb-3 font-medium transition-all ${
                  activeTab === "unstake"
                    ? "border-b-2 border-orange-500 text-orange-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unstake
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "stake" && (
                <motion.div
                  key="stake"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <p className="text-xs text-muted-foreground">
                    Wallet:{" "}
                    <span className="font-mono text-foreground">
                      {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $TASHI
                    </span>
                  </p>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground/90">Amount</label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0.0"
                      value={stakeAmount || ""}
                      onChange={(e) => setStakeAmount(Number(e.target.value))}
                      className="border-border bg-background/80 text-right font-mono text-2xl"
                    />
                  </div>

                  <Slider
                    value={[Math.min(stakeAmount, maxForSlider)]}
                    onValueChange={([v]) => setStakeAmount(v)}
                    max={maxForSlider}
                    step={10}
                    className="w-full"
                  />

                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      Fee discount:{" "}
                      <span className="font-bold text-emerald-400">{discountForAmount(stakeAmount)}%</span>
                    </div>
                    <div>
                      Priority: <span className="font-bold text-cyan-400">High</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleStake()}
                    disabled={stakeAmount <= 0 || isStaking}
                    className="h-14 w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-xl font-bold shadow-lg hover:from-emerald-500 hover:to-emerald-600"
                  >
                    {isStaking ? "Staking…" : `Stake ${stakeAmount.toLocaleString()} $TASHI`}
                  </Button>
                </motion.div>
              )}

              {activeTab === "unstake" && (
                <motion.div
                  key="unstake"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground/90">Amount</label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0.0"
                      value={unstakeAmount || ""}
                      onChange={(e) => setUnstakeAmount(Number(e.target.value))}
                      className="border-border bg-background/80 text-right font-mono text-2xl"
                    />
                  </div>

                  <Slider
                    value={[Math.min(unstakeAmount, Math.max(stakedBalance, 0))]}
                    onValueChange={([v]) => setUnstakeAmount(v)}
                    max={Math.max(stakedBalance, 1)}
                    step={1}
                    className="w-full"
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 font-mono text-xs"
                      onClick={() => setUnstakeAmount(Math.floor(stakedBalance / 2))}
                    >
                      50%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 font-mono text-xs"
                      onClick={() => setUnstakeAmount(stakedBalance)}
                    >
                      Max
                    </Button>
                  </div>

                  <Button
                    onClick={() => void handleUnstake()}
                    disabled={unstakeAmount <= 0 || unstakeAmount > stakedBalance || isUnstaking}
                    variant="outline"
                    className="h-14 w-full border-orange-500/40 text-xl font-bold text-orange-400 hover:bg-orange-500/10"
                  >
                    {isUnstaking ? "Unstaking…" : `Unstake ${unstakeAmount.toLocaleString()} $TASHI`}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </>
      )}
    </Card>
  );
}
