import type { MissionPhase } from "@/backend/shared/mission-phases";
import type { SwarmAgentNode, SwarmTaskSpec, TaskBid } from "./swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import { VENDOR_PROFILES } from "./vendor-profiles";

export type BidScoreResult = { score: number; reasons: string[] };

function sensorFit(task: SwarmTaskSpec, node: SwarmAgentNode): number {
  let hits = 0;
  for (const r of task.requirements) {
    const k = r.toLowerCase();
    if (node.capabilities.sensors.some((s) => s.toLowerCase().includes(k) || k.includes(s.toLowerCase()))) hits++;
    if (k === "thermal" && node.capabilities.thermalScore > 0.5) hits++;
    if (k === "lidar" && node.capabilities.lidarScore > 0.5) hits++;
    if (k === "relay" && node.role === "relay") hits++;
    if (k === "payload" && node.capabilities.maxPayloadKg >= 15) hits++;
  }
  return task.requirements.length ? hits / task.requirements.length : 0.6;
}

function roleFit(task: SwarmTaskSpec, node: SwarmAgentNode): number {
  return task.allowedRoles.includes(node.role) ? 1 : 0.25;
}

function vendorFit(task: SwarmTaskSpec, node: SwarmAgentNode): number {
  if (!task.preferredVendorTraits.length) return 0.75;
  const v = VENDOR_PROFILES[node.vendorId as keyof typeof VENDOR_PROFILES];
  const tags = v?.traitTags.map((t) => t.toLowerCase()) ?? [];
  let m = 0;
  for (const t of task.preferredVendorTraits) {
    if (tags.some((x) => x.includes(t.toLowerCase()))) m++;
  }
  return task.preferredVendorTraits.length ? m / task.preferredVendorTraits.length : 0.5;
}

function dist2d(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Non-trivial bid scoring: capability, role, vendor, battery, link, phase, load, blackout, trust, recovery, latency proxy.
 */
export function scoreBid(
  task: SwarmTaskSpec,
  node: SwarmAgentNode,
  bid: TaskBid,
  ctx: {
    phase: MissionPhase;
    connectivityMode: VertexConnectivityMode;
    swarmLoad: number;
    link01: number;
    telemetryHealth01: number;
  },
): BidScoreResult {
  const reasons: string[] = [];
  const cap = sensorFit(task, node);
  if (cap > 0.7) reasons.push("strong sensor / requirement fit");
  const rfit = roleFit(task, node);
  if (rfit >= 1) reasons.push("role matches task gate");
  const vfit = vendorFit(task, node);
  const battery = bid.battery01;
  const trust = node.trust01;
  const rangePenalty = dist2d(node.position, task.location) / 120;
  const phaseBoost = ctx.phase === "search" && node.capabilities.thermalScore > 0.7 ? 0.08 : 0;
  const blackoutBoost =
    ctx.connectivityMode !== "normal" && node.role === "relay" ? 0.12 : ctx.connectivityMode !== "normal" ? 0.04 : 0;
  if (blackoutBoost > 0.06) reasons.push("mesh resilience valued during degraded comms");
  const recovery = 1 - Math.min(1, node.capabilities.recoveryLatencyMs / 4000);
  const evidence = bid.confidence01 * ctx.telemetryHealth01;

  let score =
    cap * 2.1 +
    rfit * 1.4 +
    vfit * 0.9 +
    battery * 1.1 +
    ctx.link01 * 0.85 +
    trust * 1.0 +
    recovery * 0.55 +
    evidence * 0.9 -
    rangePenalty * 0.35 -
    Math.min(1, bid.etaSec / 400) * 0.4 -
    ctx.swarmLoad * 0.15 +
    phaseBoost +
    blackoutBoost;

  if (node.capabilities.thermalScore > 0.85 && task.requirements.some((x) => x.toLowerCase().includes("thermal"))) {
    reasons.push("thermal sensor fit for hotspot search");
    score += 0.15;
  }
  if (node.role === "relay" && task.taskType === "relay_extension") {
    reasons.push("relay drone chosen for long-range mesh");
    score += 0.2;
  }
  if (node.capabilities.lidarScore > 0.85 && task.requirements.some((x) => x.toLowerCase().includes("lidar"))) {
    reasons.push("LIDAR fit for indoor / low-light mapping");
    score += 0.12;
  }
  if (node.capabilities.gripperScore > 0.85 && task.taskType === "extraction_prep") {
    reasons.push("payload / gripper fit for extraction");
    score += 0.18;
  }

  return { score: Math.round(score * 1000) / 1000, reasons };
}
