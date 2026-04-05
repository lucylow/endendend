import { useEffect, useMemo, useRef } from "react";
import { useSwarmStore } from "@/store/swarmStore";
import type { Agent } from "@/types";
import type { HealthAlert, HealthAlertType } from "./types";

function issueToAlertType(issue: string): HealthAlertType {
  if (issue === "battery") return "battery";
  if (issue === "signal" || issue === "telemetry_stale" || issue === "offline") return "signal";
  if (issue === "collision") return "collision";
  return "consensus";
}

function messageForIssue(agent: Agent, issue: string): string {
  const v = agent.vitals;
  if (issue === "battery") return `Battery ${(v?.batteryLevel ?? agent.battery).toFixed(0)}% — reroute to charge.`;
  if (issue === "signal") return `RF weak (${(v?.signalStrength ?? 0).toFixed(0)}%) — check relays.`;
  if (issue === "collision") return `Separation risk ${((v?.collisionRisk ?? 0) * 100).toFixed(0)}% — slow down.`;
  if (issue === "consensus") return `Latency ${Math.round(v?.coordinationLatency ?? agent.latency)} ms — mesh stress.`;
  if (issue === "telemetry_stale") return "Telemetry stale — link may be dropping.";
  if (issue === "offline") return "Unit offline — last known pose may be invalid.";
  return "Anomaly — review vitals.";
}

function buildAlerts(agents: Agent[], now: number): HealthAlert[] {
  const out: HealthAlert[] = [];
  for (const agent of agents) {
    const issues = agent.healthIssues ?? [];
    const status = agent.healthStatus ?? "healthy";
    const vitals = agent.vitals;
    for (const issue of issues) {
      const critical =
        issue === "battery" && (vitals?.batteryLevel ?? agent.battery) < 15
          ? true
          : issue === "collision" && (vitals?.collisionRisk ?? 0) > 0.85
            ? true
            : issue === "telemetry_stale" || issue === "offline"
              ? true
              : issue === "consensus" && (vitals?.coordinationLatency ?? agent.latency) > 220
                ? true
                : false;
      const severity = critical || status === "critical" ? "critical" : "warning";
      out.push({
        id: `${agent.id}-${issue}`,
        type: issueToAlertType(issue),
        agentId: agent.id,
        severity,
        message: messageForIssue(agent, issue),
        timestamp: now,
      });
    }
  }
  return out;
}

export interface FleetHealthSummary {
  healthy: number;
  warning: number;
  degraded: number;
  critical: number;
  offline: number;
  avgScore: number;
  predictiveWarnings: number;
}

export function summarizeFleetHealth(agents: Agent[]): FleetHealthSummary {
  const acc: FleetHealthSummary = {
    healthy: 0,
    warning: 0,
    degraded: 0,
    critical: 0,
    offline: 0,
    avgScore: 0,
    predictiveWarnings: 0,
  };
  if (agents.length === 0) return acc;
  let scoreSum = 0;
  for (const a of agents) {
    const s = a.healthStatus ?? "healthy";
    if (s === "healthy") acc.healthy++;
    else if (s === "warning") acc.warning++;
    else if (s === "degraded") acc.degraded++;
    else if (s === "critical") acc.critical++;
    else if (s === "offline") acc.offline++;
    scoreSum += a.vitals?.healthScore ?? 0;
    const hs = a.vitals?.healthScore ?? 100;
    if (hs < 48 && hs >= 32 && s !== "critical" && s !== "offline") acc.predictiveWarnings++;
  }
  acc.avgScore = scoreSum / agents.length;
  return acc;
}

/**
 * Keeps vitals on agents when the sim is paused (no `updateAgentPositions` ticks).
 */
/** Periodically refreshes vitals when the local sim tick is idle (no pose updates). */
export function useRobotHealthSync() {
  const isRunning = useSwarmStore((s) => s.isRunning);
  const realtime = useSwarmStore((s) => s.realtimeTelemetryActive);
  const recompute = useSwarmStore((s) => s.recomputeAgentHealth);

  useEffect(() => {
    if (isRunning || realtime) return;
    const id = window.setInterval(() => recompute(), 5000);
    return () => window.clearInterval(id);
  }, [isRunning, realtime, recompute]);
}

export function useFleetHealthAlerts(): HealthAlert[] {
  const agents = useSwarmStore((s) => s.agents);
  return useMemo(() => buildAlerts(agents, Date.now()), [agents]);
}

export function useFleetHealthSummary(): FleetHealthSummary {
  const agents = useSwarmStore((s) => s.agents);
  return useMemo(() => summarizeFleetHealth(agents), [agents]);
}

/** Fleet summary + derived alerts from store vitals (no extra O(n²) health solve). */
export function useRobotHealth() {
  const summary = useFleetHealthSummary();
  const alerts = useFleetHealthAlerts();
  return { summary, alerts };
}

/**
 * Announces new critical alert strings once via Web Speech API (best-effort).
 */
export function useCriticalVoiceAlerts(alerts: HealthAlert[]) {
  const spokenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const critical = alerts.filter((a) => a.severity === "critical");
    if (critical.length === 0 || typeof window === "undefined") return;
    const u = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!u) return;
    for (const a of critical) {
      const key = `${a.agentId}-${a.type}`;
      if (spokenRef.current.has(key)) continue;
      spokenRef.current.add(key);
      const utter = new SpeechSynthesisUtterance(`Critical alert. Agent ${a.agentId}. ${a.message}`);
      utter.rate = 1.05;
      utter.volume = 0.9;
      u.speak(utter);
    }
  }, [alerts]);
}
