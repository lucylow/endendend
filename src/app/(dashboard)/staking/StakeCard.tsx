import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaking } from "@/features/staking/useStaking";
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

function parseAmountInput(raw: string): number {
  if (raw.trim() === "") return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
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
    isMockMode,
  } = useStaking();

  const [stakeAmount, setStakeAmount] = useState(0);
  const [unstakeAmount, setUnstakeAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  const maxForSlider = Math.max(maxStake || 10_000, 10_000);
  const stakeRoom = Math.max(0, maxStake - stakedBalance);
  const stakeUpperBound = Math.min(walletBalance, stakeRoom, maxForSlider);
  const stakeSliderMax = stakeUpperBound > 0 ? stakeUpperBound : 1;
  const progressPct = useMemo(() => {
    const cap = maxStake || 1;
    const pct = (stakedBalance / cap) * 100;
    return Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  }, [stakedBalance, maxStake]);

  const stakeOverWallet = stakeAmount > walletBalance;
  const stakeOverCap = stakeAmount > 0 && stakedBalance + stakeAmount > maxStake;
  const canSubmitStake =
    stakeAmount > 0 && !stakeOverWallet && !stakeOverCap && !isStaking;

  const handleStake = async () => {
    if (!canSubmitStake) return;
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Staked balance</span>
              <span className="font-mono text-2xl font-bold text-foreground">
                {stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $TASHI
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="mt-1 text-xs text-muted-foreground">{progressPct.toFixed(1)}% of max priority cap</p>
            {isMockMode ? (
              <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/90">
                Demo balances — connect a configured wallet for live reads and transactions.
              </p>
            ) : null}
          </div>

          <CardContent className="space-y-6 p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "stake" | "unstake")}>
              <TabsList className="grid w-full grid-cols-2 bg-muted/40">
                <TabsTrigger value="stake" className="data-[state=active]:text-emerald-400">
                  Stake
                </TabsTrigger>
                <TabsTrigger value="unstake" className="data-[state=active]:text-orange-400">
                  Unstake
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stake" className="mt-4 outline-none">
                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Wallet:{" "}
                      <span className="font-mono text-foreground">
                        {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $TASHI
                      </span>
                    </p>
                    <div>
                      <label htmlFor="stake-amount" className="mb-2 block text-sm font-medium text-foreground/90">
                        Amount
                      </label>
                      <Input
                        id="stake-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.0"
                        value={stakeAmount === 0 ? "" : String(stakeAmount)}
                        onChange={(e) => setStakeAmount(parseAmountInput(e.target.value))}
                        className="border-border bg-background/80 text-right font-mono text-2xl"
                        aria-invalid={stakeOverWallet || stakeOverCap}
                        aria-describedby="stake-amount-hint"
                      />
                      <p id="stake-amount-hint" className="mt-1 text-[11px] text-muted-foreground">
                        Remaining cap:{" "}
                        <span className="font-mono text-foreground">
                          {Math.max(0, maxStake - stakedBalance).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          $TASHI
                        </span>
                      </p>
                    </div>

                    <Slider
                      value={[Math.min(stakeAmount, stakeSliderMax)]}
                      onValueChange={([v]) => setStakeAmount(v)}
                      max={stakeSliderMax}
                      step={stakeSliderMax > 100 ? 10 : 1}
                      className="w-full"
                      aria-label="Stake amount"
                      disabled={stakeUpperBound <= 0}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[4.5rem] font-mono text-xs"
                        onClick={() => setStakeAmount(Math.min(walletBalance, maxStake - stakedBalance) * 0.25)}
                        disabled={walletBalance <= 0 || stakedBalance >= maxStake}
                      >
                        25%
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[4.5rem] font-mono text-xs"
                        onClick={() => setStakeAmount(Math.min(walletBalance, maxStake - stakedBalance) * 0.5)}
                        disabled={walletBalance <= 0 || stakedBalance >= maxStake}
                      >
                        50%
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[4.5rem] font-mono text-xs"
                        onClick={() =>
                          setStakeAmount(Math.max(0, Math.min(walletBalance, maxStake - stakedBalance)))
                        }
                        disabled={walletBalance <= 0 || stakedBalance >= maxStake}
                      >
                        Max
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        Fee discount:{" "}
                        <span className="font-bold text-emerald-400">{discountForAmount(stakedBalance + stakeAmount)}%</span>
                      </div>
                      <div>
                        Priority tier:{" "}
                        <span className="font-bold text-cyan-400">
                          {stakedBalance + stakeAmount >= 100_000
                            ? "Max"
                            : stakedBalance + stakeAmount >= 50_000
                              ? "High"
                              : stakedBalance + stakeAmount >= 10_000
                                ? "Mid"
                                : "Entry"}
                        </span>
                      </div>
                    </div>

                    {stakeOverWallet ? (
                      <p className="text-xs text-destructive" role="alert">
                        Amount exceeds wallet balance.
                      </p>
                    ) : null}
                    {stakeOverCap ? (
                      <p className="text-xs text-destructive" role="alert">
                        Total stake would exceed the priority cap ({maxStake.toLocaleString()} $TASHI).
                      </p>
                    ) : null}

                    <Button
                      onClick={() => void handleStake()}
                      disabled={!canSubmitStake}
                      className="h-14 w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-xl font-bold shadow-lg hover:from-emerald-500 hover:to-emerald-600"
                    >
                      {isStaking ? "Staking…" : `Stake ${stakeAmount.toLocaleString()} $TASHI`}
                    </Button>
                </div>
              </TabsContent>

              <TabsContent value="unstake" className="mt-4 outline-none">
                <div className="space-y-4">
                    <div>
                      <label htmlFor="unstake-amount" className="mb-2 block text-sm font-medium text-foreground/90">
                        Amount
                      </label>
                      <Input
                        id="unstake-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.0"
                        value={unstakeAmount === 0 ? "" : String(unstakeAmount)}
                        onChange={(e) => setUnstakeAmount(parseAmountInput(e.target.value))}
                        className="border-border bg-background/80 text-right font-mono text-2xl"
                      />
                    </div>

                    <Slider
                      value={[Math.min(unstakeAmount, Math.max(stakedBalance, 0))]}
                      onValueChange={([v]) => setUnstakeAmount(v)}
                      max={Math.max(stakedBalance, 1)}
                      step={1}
                      className="w-full"
                      aria-label="Unstake amount"
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 font-mono text-xs"
                        onClick={() => setUnstakeAmount(Math.floor(stakedBalance / 2))}
                        disabled={stakedBalance <= 0}
                      >
                        50%
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 font-mono text-xs"
                        onClick={() => setUnstakeAmount(stakedBalance)}
                        disabled={stakedBalance <= 0}
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
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </>
      )}
    </Card>
  );
}
