import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { MissionState } from "@/backend/shared/mission-state";
import type { NodeRegistry } from "./node-registry";
import type { PolicyRoleType } from "@/backend/shared/mission-policy";

export type AllocationFactorKey =
  | "proximity"
  | "batteryReserve"
  | "capabilityMatch"
  | "reputation"
  | "currentLoad"
  | "hazardClearance"
  | "relayContinuity"
  | "thermalMatch";

export type AllocationBreakdown = Record<AllocationFactorKey, number>;

export interface AllocationScore {
  nodeId: string;
  taskType: string;
  finalScore: number;
  breakdown: AllocationBreakdown;
  rank: number;
}

export type ScenarioWeightVector = Record<AllocationFactorKey, number>;

const Z: ScenarioWeightVector = {
  proximity: 0,
  batteryReserve: 0,
  capabilityMatch: 0,
  reputation: 0,
  currentLoad: 0,
  hazardClearance: 0,
  relayContinuity: 0,
  thermalMatch: 0,
};

function w(p: Partial<ScenarioWeightVector>): ScenarioWeightVector {
  return { ...Z, ...p };
}

function normalizeWeights(v: ScenarioWeightVector): ScenarioWeightVector {
  const sum = Object.values(v).reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...Z, proximity: 1 };
  const out = { ...Z };
  (Object.keys(v) as AllocationFactorKey[]).forEach((k) => {
    out[k] = v[k] / sum;
  });
  return out;
}

/** Scenario-tuned Lattice weights (sum normalized to 1 at runtime). */
export const POLICY_WEIGHTS: Record<MissionScenarioKind, ScenarioWeightVector> = {
  collapsed_building: normalizeWeights(
    w({
      proximity: 0.22,
      relayContinuity: 0.28,
      capabilityMatch: 0.2,
      batteryReserve: 0.12,
      reputation: 0.1,
      currentLoad: 0.04,
      hazardClearance: 0.04,
      thermalMatch: 0,
    }),
  ),
  wildfire: normalizeWeights(
    w({
      thermalMatch: 0.28,
      hazardClearance: 0.22,
      capabilityMatch: 0.18,
      proximity: 0.12,
      reputation: 0.1,
      batteryReserve: 0.06,
      currentLoad: 0.04,
      relayContinuity: 0,
    }),
  ),
  flood_rescue: normalizeWeights(
    w({
      proximity: 0.25,
      batteryReserve: 0.25,
      capabilityMatch: 0.22,
      reputation: 0.15,
      currentLoad: 0.08,
      hazardClearance: 0.05,
      relayContinuity: 0,
      thermalMatch: 0,
    }),
  ),
  hazmat: normalizeWeights(
    w({
      hazardClearance: 0.28,
      thermalMatch: 0.18,
      capabilityMatch: 0.18,
      reputation: 0.14,
      proximity: 0.1,
      batteryReserve: 0.08,
      currentLoad: 0.04,
      relayContinuity: 0,
    }),
  ),
  tunnel: normalizeWeights(
    w({
      relayContinuity: 0.3,
      capabilityMatch: 0.22,
      proximity: 0.14,
      batteryReserve: 0.12,
      reputation: 0.12,
      currentLoad: 0.06,
      hazardClearance: 0.04,
      thermalMatch: 0,
    }),
  ),
  extraction: normalizeWeights(
    w({
      capabilityMatch: 0.3,
      proximity: 0.2,
      batteryReserve: 0.18,
      reputation: 0.14,
      currentLoad: 0.1,
      hazardClearance: 0.04,
      relayContinuity: 0.04,
      thermalMatch: 0,
    }),
  ),
};

export type NodeAllocationProfile = {
  nodeId: string;
  position: { lat: number; lng: number };
  capabilities: string[];
  batteryReserve: number;
  linkQuality: number;
  activeTasks: number;
  reputation01: number;
};

function stableUnit(nodeId: string, salt: string): number {
  let h = 0;
  const s = `${nodeId}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 10_000) / 10_000;
}

/** Deterministic lat/lng stand-in when operators have not supplied telemetry fixes. */
export function defaultNodePosition(nodeId: string): { lat: number; lng: number } {
  const u = stableUnit(nodeId, "geo");
  const v = stableUnit(nodeId, "geo2");
  return { lat: 37.75 + u * 0.08, lng: -122.42 + v * 0.08 };
}

export function buildAllocationProfiles(
  mission: MissionState,
  registry: NodeRegistry,
  nowMs: number,
  staleMs: number,
): NodeAllocationProfile[] {
  const out: NodeAllocationProfile[] = [];
  for (const id of Object.keys(mission.roster)) {
    const t = registry.getTelemetry(id);
    const fresh = t?.online === true && nowMs - (t.lastSeenMs ?? 0) <= staleMs;
    const activeTasks = Object.values(mission.assignments).filter((a) => a.nodeId === id).length;
    out.push({
      nodeId: id,
      position: defaultNodePosition(id),
      capabilities: [...(mission.roster[id]?.capabilities ?? []), ...(t?.sensors ?? [])],
      batteryReserve: fresh ? (t?.batteryReserve ?? 0.5) : 0.1,
      linkQuality: fresh ? (t?.linkQuality ?? 0.5) : 0,
      activeTasks,
      reputation01: registry.latticeTrust01(id),
    });
  }
  return out.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function hasSensor(capabilities: string[], needle: string): boolean {
  const n = needle.toLowerCase();
  return capabilities.some((c) => c.toLowerCase().includes(n));
}

function relayContinuityScore(profile: NodeAllocationProfile, mission: MissionState): number {
  const entry = mission.roster[profile.nodeId];
  const relayish =
    entry?.role === "relay" || entry?.capabilities.some((c) => c.toLowerCase().includes("relay"));
  const link = profile.linkQuality;
  return Math.max(0, Math.min(1, link * (relayish ? 1 : 0.55)));
}

function hazardClearanceScore(profile: NodeAllocationProfile): number {
  const caps = profile.capabilities.map((c) => c.toLowerCase());
  let s = 0.35;
  if (caps.some((c) => ["gas", "cbrn", "hazmat"].some((k) => c.includes(k)))) s += 0.35;
  if (caps.some((c) => c.includes("thermal"))) s += 0.15;
  if (caps.some((c) => c.includes("sealed"))) s += 0.15;
  return Math.max(0, Math.min(1, s));
}

function thermalMatchScore(profile: NodeAllocationProfile): number {
  return hasSensor(profile.capabilities, "thermal") ? 1 : hasSensor(profile.capabilities, "rgb") ? 0.55 : 0.15;
}

function capabilityMatchForTask(profile: NodeAllocationProfile, taskType: string): number {
  const caps = profile.capabilities.map((c) => c.toLowerCase());
  const taskSensors: Record<string, string[]> = {
    explorer: ["optical", "thermal", "rgb"],
    relay: ["relay", "indoor", "long_range_radio"],
    extractor: ["transport", "carrier", "winch"],
    triage: ["audio", "medic"],
    transport: ["carrier", "boat", "waterproof"],
  };
  const need = taskSensors[taskType] ?? ["optical"];
  const hits = need.filter((s) => caps.some((c) => c.includes(s))).length;
  return hits / Math.max(1, need.length);
}

export class AllocationEngine {
  scoreForTask(
    nodes: NodeAllocationProfile[],
    taskType: PolicyRoleType | string,
    scenario: MissionScenarioKind,
    mission: MissionState,
    targetCoords?: { lat: number; lng: number },
  ): AllocationScore[] {
    const weights = POLICY_WEIGHTS[scenario];
    if (!weights) throw new Error(`Unknown scenario: ${scenario}`);

    const ranked = nodes.map((node) => {
      const breakdown: AllocationBreakdown = { ...Z };

      breakdown.proximity = targetCoords
        ? Math.max(0, Math.min(1, 1 - haversineKm(node.position, targetCoords) / 25))
        : 0.55;

      breakdown.batteryReserve = Math.max(0, Math.min(1, node.batteryReserve));
      breakdown.capabilityMatch = capabilityMatchForTask(node, taskType);
      breakdown.reputation = Math.max(0, Math.min(1, node.reputation01));
      breakdown.currentLoad = Math.max(0, Math.min(1, 1 - Math.min(node.activeTasks, 5) / 5));
      breakdown.hazardClearance = hazardClearanceScore(node);
      breakdown.relayContinuity = relayContinuityScore(node, mission);
      breakdown.thermalMatch = thermalMatchScore(node);

      let finalScore = 0;
      (Object.keys(weights) as AllocationFactorKey[]).forEach((key) => {
        finalScore += weights[key] * breakdown[key];
      });

      return {
        nodeId: node.nodeId,
        taskType,
        finalScore: Math.max(0, Math.min(1, finalScore)),
        breakdown,
        rank: 0,
      };
    });

    ranked.sort((a, b) => b.finalScore - a.finalScore || a.nodeId.localeCompare(b.nodeId));
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
    return ranked;
  }

  /** Operator-facing explanation with percentage-style factors. */
  explainAssignment(top: AllocationScore, scenario: MissionScenarioKind): string {
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const w = POLICY_WEIGHTS[scenario];
    const parts: string[] = [];
    (Object.keys(w) as AllocationFactorKey[]).forEach((k) => {
      if (w[k] > 0.02) parts.push(`${k} ${pct(top.breakdown[k])}`);
    });
    return `Node ${top.nodeId} assigned (${scenario}): ${parts.slice(0, 4).join(", ")} — blended score ${top.finalScore.toFixed(3)}`;
  }
}
