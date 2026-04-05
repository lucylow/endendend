import { useMemo } from "react";
import { useSwarmStore } from "@/store/swarmStore";
import type { Agent } from "@/types";

export type CameraMode = "orbit" | "top-down" | "follow-leader";

export function useSwarmVisualization() {
  const agents = useSwarmStore((s) => s.agents);
  const swarm = useSwarmStore((s) => s.swarm);
  const isRunning = useSwarmStore((s) => s.isRunning);
  const consensusMetrics = useSwarmStore((s) => s.consensusMetrics);

  return useMemo(() => {
    const active = agents.filter((a) => a.status === "active");
    const avgBattery = active.length ? active.reduce((s, a) => s + a.battery, 0) / active.length : 0;
    const avgLatency =
      active.length > 0 ? Math.round(active.reduce((s, a) => s + a.latency, 0) / active.length) : 0;
    const coordinationLatency =
      consensusMetrics.avgLatencyMs > 0
        ? Math.round(consensusMetrics.avgLatencyMs)
        : avgLatency;
    const leader: Agent | undefined = agents.find((a) => a.role === "explorer" && a.status === "active");
    const relayChain = agents.filter((a) => a.role === "relay" || a.role === "explorer");
    const criticalBattery = agents.filter((a) => a.battery < 20).length;

    return {
      agents,
      swarm,
      isRunning,
      agentCount: active.length,
      avgBattery,
      coordinationLatency,
      leader,
      relayChain,
      criticalBattery,
    };
  }, [agents, swarm, isRunning, consensusMetrics.avgLatencyMs]);
}
