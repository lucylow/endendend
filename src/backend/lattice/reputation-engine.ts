/** Lightweight Lattice reputation adjustments (deterministic, local demo). */

import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MissionLedger, MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

export type ReputationDeltaReason =
  | "heartbeat_streak"
  | "task_completed"
  | "task_abandoned"
  | "safety_false_alarm"
  | "vertex_slash_demo";

export function applyReputationDelta(
  scores: Record<string, number>,
  nodeId: string,
  delta: number,
  _reason: ReputationDeltaReason,
): Record<string, number> {
  const prev = scores[nodeId] ?? 100;
  const next = Math.max(0, Math.min(200, prev + delta));
  return { ...scores, [nodeId]: next };
}

/** Normalized trust snapshot committed to the lattice plane after Vertex-ordered proofs. */
export interface ReputationScore {
  nodeId: string;
  missionId: string;
  baseScore: number;
  decay: number;
  proofContributions: number;
  uptime: number;
  violations: number;
  finalScore: number;
  updateEventHash?: string;
}

export type ReputationEngineOptions = {
  /** When false, ``computeScore`` does not append ``reputation_update`` (handy for dry runs). */
  persistToLedger?: boolean;
};

/**
 * Proof-grounded reputation: folds Vertex mission proofs and Lattice liveness / safety
 * signals, then optionally commits a ``reputation_update`` ledger event.
 */
export class ReputationEngine {
  private readonly ledger: MissionLedger;
  private readonly DECAY_RATE = 0.1;
  private readonly PROOF_BONUS = 0.15;
  private readonly HEARTBEAT_BONUS = 0.05;
  private readonly VIOLATION_PENALTY = 0.2;
  private readonly persist: boolean;

  constructor(ledger: MissionLedger, opts: ReputationEngineOptions = {}) {
    this.ledger = ledger;
    this.persist = opts.persistToLedger !== false;
  }

  private isProofFailure(e: MissionLedgerEvent): boolean {
    if (e.eventType === "node_offline" && e.plane === "lattice") return true;
    if (e.eventType !== "safety_alert") return false;
    const kind = String(e.payload?.kind ?? "").toLowerCase();
    const msg = String(e.payload?.message ?? "").toLowerCase();
    if (kind.includes("geofence") || msg.includes("geofence")) return true;
    if (kind.includes("telemetry") || msg.includes("telemetry")) return true;
    if (e.payload?.level === "critical" && (kind.includes("inconsistent") || msg.includes("inconsistent"))) return true;
    return false;
  }

  private isPositiveProof(e: MissionLedgerEvent): boolean {
    if (e.plane !== "vertex") return false;
    switch (e.eventType) {
      case "target_discovered":
      case "target_confirmed":
      case "extraction_confirmed":
        return true;
      case "recovery_checkpoint": {
        const label = String(e.payload?.label ?? "").toLowerCase();
        return label.includes("relay");
      }
      default:
        return false;
    }
  }

  /**
   * Fold ledger events for ``nodeId`` × ``missionId`` into a clamped score.
   * Skips prior ``reputation_update`` rows so recompute stays stable.
   */
  evaluateFromLedger(nodeId: string, missionId: string): Omit<ReputationScore, "updateEventHash"> {
    const events = this.ledger.eventsForNodeInMission(nodeId, missionId).filter((e) => e.eventType !== "reputation_update");

    let score = 0.5;
    let contributions = 0;
    let violations = 0;
    let heartbeats = 0;

    for (const event of events) {
      switch (event.eventType) {
        case "node_heartbeat":
          if (event.plane === "lattice") {
            heartbeats++;
            score = Math.min(1, score + this.HEARTBEAT_BONUS);
          }
          break;
        default:
          if (this.isPositiveProof(event)) {
            contributions++;
            score = Math.min(1, score + this.PROOF_BONUS);
          } else if (this.isProofFailure(event)) {
            violations++;
            score = Math.max(0, score - this.VIOLATION_PENALTY);
          }
          break;
      }
    }

    const decay = violations > 0 ? Math.min(score, this.DECAY_RATE * violations) : 0;
    const finalScore = Math.max(0, Math.min(1, score - decay + contributions * 0.05));

    return {
      nodeId,
      missionId,
      baseScore: score,
      decay,
      proofContributions: contributions,
      uptime: heartbeats,
      violations,
      finalScore,
    };
  }

  async computeScore(nodeId: string, missionId: string, nowMs: number): Promise<ReputationScore> {
    const core = this.evaluateFromLedger(nodeId, missionId);
    const row: ReputationScore = { ...core };

    if (this.persist) {
      const ev = await this.ledger.append({
        missionId,
        actorId: nodeId,
        eventType: "reputation_update",
        plane: "lattice",
        payload: { ...core, recordedAtMs: nowMs },
        timestamp: nowMs,
        previousHash: this.ledger.tailHash(),
      });
      row.updateEventHash = ev.eventHash;
    }

    return row;
  }

  missionNodeIds(missionId: string): string[] {
    const { roster } = replayMissionFromLedger(this.ledger.toArray(), missionId);
    return Object.keys(roster);
  }

  async getMissionScores(missionId: string, nowMs: number): Promise<ReputationScore[]> {
    const ids = this.missionNodeIds(missionId);
    const out: ReputationScore[] = [];
    for (const nodeId of ids) {
      out.push(await this.computeScore(nodeId, missionId, nowMs));
    }
    return out;
  }

  /**
   * Rank roster nodes for a Vertex task hint: weighted mix of ledger reputation and role fit.
   */
  rankNodesForTask(
    missionId: string,
    taskType: "explorer" | "relay" | "extractor" | "triage",
    nowMs: number,
  ): string[] {
    const { roster } = replayMissionFromLedger(this.ledger.toArray(), missionId);
    const scored = Object.keys(roster).map((nodeId) => {
      const rep = this.evaluateFromLedger(nodeId, missionId).finalScore;
      const entry = roster[nodeId];
      let roleFit = 0.35;
      if (taskType === "explorer" && (entry.role === "explorer" || entry.capabilities.some((c) => c.toLowerCase().includes("explorer"))))
        roleFit = 0.95;
      if (taskType === "relay" && (entry.role === "relay" || entry.capabilities.some((c) => c.toLowerCase().includes("relay")))) roleFit = 0.95;
      if (
        taskType === "extractor" &&
        (entry.role === "carrier" || entry.capabilities.some((c) => ["carrier", "winch"].includes(c.toLowerCase())))
      )
        roleFit = 0.95;
      if (taskType === "triage" && (entry.role === "medic" || entry.capabilities.some((c) => c.toLowerCase().includes("medic")))) roleFit = 0.95;
      const blend = 0.55 * rep + 0.45 * roleFit;
      return { nodeId, blend };
    });
    scored.sort((a, b) => b.blend - a.blend || a.nodeId.localeCompare(b.nodeId));
    return scored.map((s) => s.nodeId);
  }
}
