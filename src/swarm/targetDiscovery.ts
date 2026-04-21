import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { MonotonicSharedMap } from "./sharedMap";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { TargetCandidate, TargetEvidence, SensorEvidenceKind } from "./types";

type Rng = () => number;

function evidenceId(): string {
  return `ev-${Math.random().toString(36).slice(2, 10)}`;
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Weight sensor trust by scenario emphasis. */
export function scenarioSensorWeight(scenario: MissionScenarioKind, sensor: SensorEvidenceKind): number {
  const s = String(scenario);
  const thermal = s.includes("wildfire") || s.includes("night") || s.includes("triage") || s.includes("flood");
  const gas = s.includes("hazmat") || s.includes("collapsed");
  const lidar = s.includes("tunnel") || s.includes("indoor");
  if (sensor === "thermal" && thermal) return 1.15;
  if (sensor === "gas" && gas) return 1.2;
  if (sensor === "lidar_shape" && lidar) return 1.12;
  if (sensor === "peer_confirm") return 1.25;
  if (sensor === "operator_note") return 1.1;
  return 1;
}

export class TargetDiscoveryPipeline {
  private candidates = new Map<string, TargetCandidate>();
  private serial = 1;

  nextCandidateId(): string {
    return `tgt-${this.serial++}`;
  }

  getCandidates(): TargetCandidate[] {
    return [...this.candidates.values()];
  }

  /** Merge or create candidate near (gx,gz). */
  private findOrCreateCandidate(missionId: string, gx: number, gz: number, world: { x: number; y: number; z: number }): TargetCandidate {
    for (const c of this.candidates.values()) {
      if (Math.abs(c.gx - gx) <= 1 && Math.abs(c.gz - gz) <= 1) return c;
    }
    const id = this.nextCandidateId();
    const cand: TargetCandidate = {
      candidateId: id,
      missionId,
      gx,
      gz,
      world: { ...world },
      evidence: [],
      mergedConfidence01: 0,
      status: "candidate",
      trustExplanation: [],
    };
    this.candidates.set(id, cand);
    return cand;
  }

  addEvidence(args: {
    missionId: string;
    node: SwarmAgentNode;
    sensor: SensorEvidenceKind;
    confidence01: number;
    nowMs: number;
    scenario: MissionScenarioKind;
    note?: string;
  }): { candidate: TargetCandidate; promoted: boolean } {
    const { missionId, node, sensor, confidence01, nowMs, scenario, note } = args;
    const { gx, gz } = MonotonicSharedMap.worldToGrid(node.position.x, node.position.z);
    const w = scenarioSensorWeight(scenario, sensor);
    const ev: TargetEvidence = {
      id: evidenceId(),
      sensor,
      confidence01: Math.min(1, confidence01 * w),
      nodeId: node.nodeId,
      atMs: nowMs,
      note,
    };
    const cand = this.findOrCreateCandidate(missionId, gx, gz, node.position);
    cand.evidence.push(ev);
    const distinctNodes = new Set(cand.evidence.map((e) => e.nodeId));
    const agg = cand.evidence.reduce((s, e) => s + e.confidence01, 0) / Math.max(1, cand.evidence.length);
    const corroboration = distinctNodes.size >= 2 ? 0.18 : 0;
    cand.mergedConfidence01 = Math.min(1, agg + corroboration);
    cand.trustExplanation = [
      `sources=${distinctNodes.size}`,
      `sensors=${[...new Set(cand.evidence.map((e) => e.sensor))].join(",")}`,
      `scenario_weight=${w.toFixed(2)}`,
    ];
    const promoted = cand.status === "candidate" && (cand.mergedConfidence01 >= 0.82 || distinctNodes.size >= 2);
    if (promoted) {
      cand.status = "confirmed";
      cand.confirmedByNodeId = [...distinctNodes].find((id) => id !== node.nodeId) ?? node.nodeId;
    }
    return { candidate: cand, promoted };
  }

  /** Probabilistic sensor hit when cell searched — heterogeneous nodes. */
  maybeSensorHit(
    node: SwarmAgentNode,
    scenario: MissionScenarioKind,
    rng: Rng,
  ): { sensor: SensorEvidenceKind; confidence01: number; note?: string } | null {
    const sensors = node.capabilities.sensors;
    const pick = (s: SensorEvidenceKind, base: number) => ({ sensor: s, confidence01: base + rng() * 0.12 });

    if (sensors.includes("thermal") && rng() < 0.08 + node.capabilities.thermalScore * 0.06) {
      return pick("thermal", 0.55 + node.capabilities.thermalScore * 0.25);
    }
    if (sensors.includes("lidar") && rng() < 0.06 + node.capabilities.lidarScore * 0.05) {
      return pick("lidar_shape", 0.5 + node.capabilities.lidarScore * 0.28);
    }
    if (sensors.includes("optical") && rng() < 0.05 + node.capabilities.lowLightScore * 0.04) {
      return pick("optical", 0.45 + rng() * 0.2);
    }
    if (sensors.some((s) => s.includes("gas")) && scenario === "hazmat" && rng() < 0.07) {
      return { sensor: "gas", confidence01: 0.62 + rng() * 0.15, note: "plume_edge" };
    }
    if (sensors.some((s) => s.includes("audio")) && (scenario === "collapsed_building" || scenario === "triage_operation") && rng() < 0.05) {
      return { sensor: "audio", confidence01: 0.48 + rng() * 0.2 };
    }
    return null;
  }

  injectOperatorNote(missionId: string, gx: number, gz: number, world: { x: number; y: number; z: number }, nowMs: number): TargetCandidate {
    const cand = this.findOrCreateCandidate(missionId, gx, gz, world);
    cand.evidence.push({
      id: evidenceId(),
      sensor: "operator_note",
      confidence01: 0.75,
      nodeId: "operator",
      atMs: nowMs,
      note: "manual_inject",
    });
    cand.mergedConfidence01 = Math.min(1, cand.mergedConfidence01 + 0.2);
    cand.trustExplanation.push("operator_note_injected");
    return cand;
  }

  /** Dedupe confirmed targets for mission state keys. */
  confirmedTargets(): TargetCandidate[] {
    return [...this.candidates.values()].filter((c) => c.status === "confirmed");
  }

  nearestConfirmer(candidate: TargetCandidate, nodes: SwarmAgentNode[]): SwarmAgentNode | undefined {
    let best: SwarmAgentNode | undefined;
    let bestD = Infinity;
    for (const n of nodes) {
      if (n.nodeId === candidate.evidence[0]?.nodeId) continue;
      const d = distance(n.position, candidate.world);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }
}
