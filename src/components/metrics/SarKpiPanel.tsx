import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  CartesianGrid,
} from "recharts";
import { useSwarmStore } from "@/store/swarmStore";
import { useScenarioOrchestratorStore } from "@/store/scenarioOrchestratorStore";
import type { ScenarioDefinition } from "@/lib/scenarios/registry";

export default function SarKpiPanel({ scenario }: { scenario: ScenarioDefinition | undefined }) {
  const consensusMetrics = useSwarmStore((s) => s.consensusMetrics);
  const faultConfig = useSwarmStore((s) => s.faultConfig);
  const agents = useSwarmStore((s) => s.agents);
  const performance = useScenarioOrchestratorStore((s) => s.performance);
  const chaosLevel = useScenarioOrchestratorStore((s) => s.chaosLevel);

  const latencyData = useMemo(
    () => consensusMetrics.latencyHistory.slice(-14).map((ms, i) => ({ i: i + 1, ms: Math.round(ms) })),
    [consensusMetrics.latencyHistory],
  );

  const barData = useMemo(() => {
    const active = agents.filter((a) => a.status === "active").length;
    return [
      { name: "Packet loss %", v: faultConfig.packetLoss },
      { name: "Active agents", v: active * 4 },
      { name: "Stress (chaos)", v: chaosLevel * 25 },
    ];
  }, [agents, faultConfig.packetLoss, chaosLevel]);

  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/80 bg-gradient-to-br from-violet-500/10 via-transparent to-emerald-500/10 p-4 backdrop-blur-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Unbreakable warehouse</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          {scenario ? (
            <>
              <span className="mr-2">{scenario.emoji}</span>
              {scenario.name}
            </>
          ) : (
            "Vertex Swarm SAR"
          )}
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Target uptime</dt>
            <dd className="font-mono text-lg text-emerald-400">{performance.uptime.toFixed(2)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">vs static planning</dt>
            <dd className="font-mono text-lg text-violet-300">{performance.speedupVsStatic.toFixed(1)}×</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Consensus quality</dt>
            <dd className="font-mono text-lg text-cyan-300">{(performance.consensusOptimality * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Live agents</dt>
            <dd className="font-mono text-lg text-foreground">{activeCount}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/40 p-3 backdrop-blur-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Consensus latency</p>
        <div className="h-36 w-full">
          {latencyData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Run a scenario — latency fills after BFT rounds.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                <XAxis dataKey="i" tick={{ fill: "hsl(215 15% 55%)", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(215 15% 55%)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 22%)", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(200 20% 80%)" }}
                />
                <Line type="monotone" dataKey="ms" stroke="hsl(185 80% 50%)" strokeWidth={2} dot={false} name="ms" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/40 p-3 backdrop-blur-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Load & stress</p>
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(215 15% 55%)", fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={{ fill: "hsl(215 15% 55%)", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 22%)", borderRadius: 8 }}
              />
              <Bar dataKey="v" fill="hsl(270 65% 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
