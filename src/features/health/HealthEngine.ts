import type { Agent } from "@/types";
import type { FaultConfig } from "@/types";
import type { HealthHistoryPoint, HealthStatus, RobotHealth, RobotVitals } from "./types";
import { appendHealthHistory } from "./types";

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const TELEMETRY_STALE_MS = 8000;

function distXZ(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

export function calculateCollisionProximity(agent: Agent, allAgents: Agent[]): number {
  let minD = Infinity;
  for (const o of allAgents) {
    if (o.id === agent.id) continue;
    const d = distXZ(agent.position, o.position);
    if (d < minD) minD = d;
  }
  if (!Number.isFinite(minD)) return 0;
  const dangerRadius = 2.2;
  if (minD >= dangerRadius * 4) return 0;
  return Math.min(1, Math.max(0, 1 - minD / (dangerRadius * 4)));
}

function deriveSignalStrength(agent: Agent, fault: FaultConfig): number {
  const latencyPenalty = Math.min(85, agent.latency * 1.2);
  const lossPenalty = fault.packetLoss * 0.85;
  const byzantinePenalty = fault.byzantineNodes > 0 ? 8 : 0;
  return Math.max(0, Math.min(100, 100 - latencyPenalty - lossPenalty - byzantinePenalty));
}

function telemetryStale(agent: Agent, now: number): boolean {
  if (agent.lastTelemetryServerMs == null) return false;
  return now - agent.lastTelemetryServerMs > TELEMETRY_STALE_MS;
}

export function calculateRobotHealth(
  agent: Agent,
  allAgents: Agent[],
  fault: FaultConfig,
  now: number,
): RobotHealth {
  const collisionRisk = calculateCollisionProximity(agent, allAgents);
  const signalStrength = deriveSignalStrength(agent, fault);
  const stale = telemetryStale(agent, now);

  const vitals: RobotVitals = {
    batteryLevel: agent.battery,
    signalStrength,
    coordinationLatency: agent.latency,
    collisionRisk,
    temperature: 24 + (agent.latency / 200) * 8 + collisionRisk * 4,
    uptime: now % 86400000,
    healthScore: 0,
  };

  const latencyNorm = Math.min(1, vitals.coordinationLatency / 250);
  const tempStress = Math.min(1, Math.max(0, (vitals.temperature - 26) / 35));

  vitals.healthScore = Math.round(
    vitals.batteryLevel * 0.3 +
      (vitals.signalStrength / 100) * 100 * 0.22 +
      (1 - latencyNorm) * 100 * 0.2 +
      (1 - vitals.collisionRisk) * 100 * 0.18 +
      (1 - tempStress) * 100 * 0.1,
  );

  const issues: string[] = [];
  const recommendations: string[] = [];

  if (agent.status === "offline" || stale) {
    issues.push(stale ? "telemetry_stale" : "offline");
    recommendations.push("Verify radio link and last telemetry timestamp.");
  }
  if (vitals.batteryLevel < 35) {
    issues.push("battery");
    recommendations.push("Route to charge or swap pack.");
  }
  if (vitals.signalStrength < 32) {
    issues.push("signal");
    recommendations.push("Insert relay or reduce obstruction.");
  }
  if (vitals.coordinationLatency > 180) {
    issues.push("consensus");
    recommendations.push("Check mesh load and fault injection settings.");
  }
  if (vitals.collisionRisk > 0.72) {
    issues.push("collision");
    recommendations.push("Widen separation or slow approach speed.");
  }

  const status = determineStatus(vitals, agent, stale);
  if (status === "critical") recommendations.unshift("Execute emergency hold or RTL per playbook.");

  return { status, vitals, issues, recommendations };
}

function determineStatus(vitals: RobotVitals, agent: Agent, stale: boolean): HealthStatus {
  if (agent.status === "offline") return "offline";
  if (stale) return "degraded";

  const score = vitals.healthScore;
  if (vitals.batteryLevel < 12 || vitals.collisionRisk > 0.88) return "critical";
  if (score > 82 && vitals.batteryLevel >= 25 && vitals.collisionRisk < 0.55) return "healthy";
  if (score > 55) return "warning";
  if (score > 32) return "degraded";
  return "critical";
}

export function applyHealthToAgents(
  agents: Agent[],
  fault: FaultConfig,
  now: number,
): Agent[] {
  return agents.map((agent) => {
    const { status, vitals, issues } = calculateRobotHealth(agent, agents, fault, now);
    const prev = agent.healthHistory ?? [];
    const last = prev[prev.length - 1];
    const shouldSample =
      !last ||
      now - last.t > 4000 ||
      last.status !== status ||
      Math.abs(last.score - vitals.healthScore) >= 3;

    const healthHistory = shouldSample
      ? appendHealthHistory(prev, { t: now, score: vitals.healthScore, status }, HISTORY_WINDOW_MS)
      : prev;

    let nextStatus: Agent["status"] = agent.status;
    if (vitals.batteryLevel < 18 && agent.status === "active") nextStatus = "low-battery";
    else if (vitals.batteryLevel >= 22 && agent.status === "low-battery") nextStatus = "active";

    return {
      ...agent,
      status: nextStatus,
      healthStatus: status,
      vitals,
      lastHealthCheck: now,
      healthHistory,
      healthIssues: issues,
    };
  });
}
