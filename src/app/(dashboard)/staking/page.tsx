import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { StakeCard } from "./StakeCard";
import { RewardsCard } from "./RewardsCard";
import { APYCalculator } from "./APYCalculator";
import { SwarmRewardsMechanism } from "./SwarmRewardsMechanism";
import { StakingProvider, useStaking } from "./StakingProvider";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Wallet, DollarSign, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAccount, useDisconnect } from "wagmi";

const rewardHistory = [
  { month: "Jan", rewards: 820 },
  { month: "Feb", rewards: 910 },
  { month: "Mar", rewards: 1240 },
  { month: "Apr", rewards: 1180 },
  { month: "May", rewards: 1320 },
  { month: "Jun", rewards: 1460 },
];

function StatCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="border-border bg-card/50 shadow-lg ring-1 ring-border/40">
        <CardContent className="p-6">
          <Icon className="mb-3 h-6 w-6 text-emerald-400/90" />
          <div className="font-mono text-3xl font-bold tracking-tight text-foreground">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{title}</div>
          <div className="mt-2 font-mono text-xs text-emerald-400/90">{change}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatsRow() {
  const { walletBalance, totalStaked, apy } = useStaking();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <StatCard
        title="Your balance ($TASHI)"
        value={walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        change="+12.5% vs last epoch"
        icon={DollarSign}
      />
      <StatCard
        title="Total network stake"
        value={totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        change="+8.2% TVL"
        icon={Shield}
      />
      <StatCard title="Current APY" value={`${apy.toFixed(1)}%`} change="+0.3% vs target" icon={TrendingUp} />
    </div>
  );
}

function NetworkStats() {
  return (
    <Card className="border-border bg-card/40">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Reward accrual (network)</h3>
            <p className="text-sm text-muted-foreground">Illustrative monthly rewards index — wire to subgraph when live.</p>
          </div>
        </div>
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rewardHistory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rewardFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="rewards"
                stroke="rgb(52 211 153)"
                strokeWidth={2}
                fill="url(#rewardFill)"
                name="Rewards index"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function WalletBar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { isContractConfigured } = useStaking();

  if (!isConnected) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-2 font-mono text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-foreground">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
      </div>
      {!isContractConfigured && (
        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-200 ring-1 ring-amber-500/30">
          Demo mode — set VITE_STAKING_CONTRACT_ADDRESS for live staking
        </span>
      )}
      {import.meta.env.DEV && !isConnected && (
        <span className="text-xs text-muted-foreground">Connect a wallet for live reads; headline stats use dev mocks.</span>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}

export default function StakingPage() {
  return (
    <StakingProvider>
      <div className="mx-auto max-w-7xl space-y-8 p-0 sm:p-1">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-zinc-950 shadow-lg shadow-emerald-500/20">
            <Shield className="h-6 w-6" />
            <span className="text-lg font-bold">Stake-protected priority</span>
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            $TASHI staking
          </h1>
          <p className="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
            Stake $TASHI to unlock coordination fee discounts (up to 50%), congestion priority, and stake-weighted rewards
            from the operator pool funded by coordination minutes and settlements. Numbers are illustrative — verify
            on-chain policy before mainnet commitments.
          </p>
          <WalletBar />
        </motion.header>

        <StatsRow />

        <SwarmRewardsMechanism />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <StakeCard />
          <RewardsCard />
        </div>

        <APYCalculator />

        <NetworkStats />
      </div>
    </StakingProvider>
  );
}
