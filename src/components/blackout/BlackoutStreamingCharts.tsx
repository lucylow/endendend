import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SwarmMetricPoint } from "@/hooks/useStreamingMetric";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PeersChart = memo(function PeersChart({ data }: { data: SwarmMetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="t" tickFormatter={(v) => `${Math.round((v as number) % 100000)}`} stroke="#71717a" fontSize={10} />
        <YAxis stroke="#71717a" fontSize={10} width={32} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }}
          labelFormatter={() => "Sample"}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="peersOnline" name="Online" stroke="#22c55e" dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey="peersStale" name="Stale" stroke="#eab308" dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey="peersIsolated" name="Isolated" stroke="#ef4444" dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
});

const LossChart = memo(function LossChart({ data, keys }: { data: SwarmMetricPoint[]; keys: string[] }) {
  const rows = useMemo(() => {
    return data.map((p) => {
      const row: Record<string, number | string> = { t: p.t };
      for (const k of keys) {
        row[k] = Math.round(((p.packetLossByDrone[k] ?? 0) as number) * 1000) / 10;
      }
      return row;
    });
  }, [data, keys]);
  if (!keys.length) {
    return <p className="text-[11px] text-muted-foreground py-8 text-center">No link telemetry yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="t" hide />
        <YAxis stroke="#71717a" fontSize={10} width={36} unit="%" />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            name={k.replace("agent-", "")}
            stackId="a"
            fill={["#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#34d399"][i % 5]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
});

const LatencyChart = memo(function LatencyChart({ data }: { data: SwarmMetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="t" hide />
        <YAxis stroke="#71717a" fontSize={10} width={36} unit="ms" />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="consensusP50" name="p50" stroke="#94a3b8" dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey="consensusP95" name="p95" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey="consensusP99" name="p99" stroke="#f472b6" dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
});

const RewardChart = memo(function RewardChart({ data }: { data: SwarmMetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="t" hide />
        <YAxis stroke="#71717a" fontSize={10} width={44} />
        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }} />
        <Area type="monotone" dataKey="rewardTotal" name="Reward (demo curve)" stroke="#a78bfa" fill="url(#rwFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
});

export const BlackoutStreamingCharts = memo(function BlackoutStreamingCharts({ points }: { points: SwarmMetricPoint[] }) {
  const lossKeys = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return [];
    return Object.keys(last.packetLossByDrone).slice(0, 5);
  }, [points]);

  return (
    <Card variant="mission" className="border-zinc-800" data-tour="charts">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Streaming metrics</CardTitle>
        <CardDescription className="text-xs">
          Sliding window (60 pts) · ingress throttled to 10 Hz · WebSocket ``swarm_metrics`` supported via hook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Peer counts</p>
          <PeersChart data={points} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Packet loss % (stacked by drone)</p>
          <LossChart data={points} keys={lossKeys} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Consensus latency (mesh links)</p>
          <LatencyChart data={points} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Reward accumulation (ledger-weighted demo)</p>
          <RewardChart data={points} />
        </div>
      </CardContent>
    </Card>
  );
});
