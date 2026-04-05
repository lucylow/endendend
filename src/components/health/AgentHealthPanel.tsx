import type { ComponentType } from "react";
import { Battery, Gauge, Radio, Signal, Thermometer, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { DegradationTimeline } from "@/components/health/DegradationTimeline";
import { HealthBadge } from "@/components/health/HealthBadge";
import { useSwarmStore } from "@/store/swarmStore";
import type { HealthStatus, RobotVitals } from "@/features/health/types";
import { cn } from "@/lib/utils";

function healthTextClass(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "text-emerald-400";
    case "warning":
      return "text-amber-400";
    case "degraded":
      return "text-orange-400";
    case "critical":
      return "text-red-400";
    case "offline":
      return "text-zinc-500";
  }
}

function HealthGauge({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>Composite health</span>
        <span className="font-mono text-zinc-300">{v.toFixed(0)} / 100</span>
      </div>
      <Progress value={v} className="h-2 bg-zinc-800" />
    </div>
  );
}

function VitalRow({
  icon: Icon,
  label,
  value,
  sub,
  warn,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
        warn ? "border-amber-500/35 bg-amber-500/5" : "border-zinc-800/80 bg-zinc-900/40",
      )}
    >
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-right">
        <div className="font-mono text-xs text-zinc-100">{value}</div>
        {sub ? <div className="text-[10px] text-zinc-500">{sub}</div> : null}
      </div>
    </div>
  );
}

function VitalsTable({ vitals }: { vitals: RobotVitals | undefined }) {
  if (!vitals) {
    return <p className="text-xs text-zinc-500">No vitals yet.</p>;
  }
  return (
    <div className="space-y-2">
      <VitalRow icon={Battery} label="Battery" value={`${vitals.batteryLevel.toFixed(0)}%`} />
      <VitalRow icon={Signal} label="Signal (derived)" value={`${vitals.signalStrength.toFixed(0)}%`} />
      <VitalRow icon={Radio} label="Coord. latency" value={`${vitals.coordinationLatency.toFixed(0)} ms`} />
      <VitalRow
        icon={Gauge}
        label="Collision risk"
        value={`${(vitals.collisionRisk * 100).toFixed(0)}%`}
        warn={vitals.collisionRisk > 0.55}
      />
      <VitalRow icon={Thermometer} label="Est. thermal load" value={`${vitals.temperature.toFixed(1)} °C`} />
      <VitalRow icon={Timer} label="Health score" value={`${vitals.healthScore.toFixed(0)}`} />
    </div>
  );
}

export function AgentHealthPanel() {
  const selectedAgentId = useSwarmStore((s) => s.selectedAgentId);
  const agent = useSwarmStore((s) => s.agents.find((a) => a.id === selectedAgentId));

  if (!selectedAgentId || !agent) return null;

  const status = agent.healthStatus ?? "healthy";
  const score = agent.vitals?.healthScore ?? 0;

  return (
    <div className="border-t border-zinc-800/80 bg-zinc-950/40 px-3 py-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{agent.name}</span>
            <HealthBadge status={status} compact />
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{agent.id}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            status === "healthy" && "border-emerald-500/40 bg-emerald-500/10",
            status === "warning" && "border-amber-500/40 bg-amber-500/10",
            status === "degraded" && "border-orange-500/40 bg-orange-500/10",
            status === "critical" && "border-red-500/40 bg-red-500/10",
            status === "offline" && "border-zinc-600 bg-zinc-800/80",
          )}
        >
          <Gauge className={cn("h-5 w-5", healthTextClass(status))} aria-hidden />
        </div>
      </div>

      <div className="mb-3 rounded-xl bg-gradient-to-r from-zinc-950 to-zinc-900/90 p-3 ring-1 ring-zinc-800/80">
        <div className={cn("text-lg font-bold capitalize", healthTextClass(status))}>{status}</div>
        <div className="text-[11px] text-zinc-500">Health score: {score.toFixed(1)} / 100</div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid h-8 w-full grid-cols-3 bg-zinc-900/80">
          <TabsTrigger value="overview" className="text-[10px]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="vitals" className="text-[10px]">
            Vitals
          </TabsTrigger>
          <TabsTrigger value="history" className="text-[10px]">
            History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3 space-y-3">
          <HealthGauge value={score} />
          <div className="grid grid-cols-1 gap-2">
            <VitalRow
              icon={Battery}
              label="Battery"
              value={`${agent.battery.toFixed(0)}%`}
              warn={agent.battery < 35}
            />
            <VitalRow
              icon={Signal}
              label="Signal (derived)"
              value={`${(agent.vitals?.signalStrength ?? 0).toFixed(0)}%`}
              warn={(agent.vitals?.signalStrength ?? 100) < 40}
            />
          </div>
        </TabsContent>
        <TabsContent value="vitals" className="mt-3">
          <VitalsTable vitals={agent.vitals} />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <DegradationTimeline data={agent.healthHistory ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
