import type { MissionPhase } from "@/backend/shared/mission-phases";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import type { SwarmAgentNode, SwarmTaskSpec, TaskBid } from "./swarm-types";
import { scoreBid } from "./bid-scorer";

export class TaskOrchestrator {
  private tasks = new Map<string, SwarmTaskSpec>();

  getTasks(): SwarmTaskSpec[] {
    return [...this.tasks.values()];
  }

  getTask(id: string): SwarmTaskSpec | undefined {
    return this.tasks.get(id);
  }

  openTask(spec: SwarmTaskSpec): void {
    this.tasks.set(spec.taskId, { ...spec, bids: [...spec.bids], fallbackNodeIds: [...spec.fallbackNodeIds] });
  }

  submitBid(taskId: string, bid: TaskBid): void {
    const t = this.tasks.get(taskId);
    if (!t || t.status !== "open" && t.status !== "bidding") return;
    t.bids.push({ ...bid, scoreReasons: [...bid.scoreReasons] });
    t.status = "bidding";
  }

  scorePendingBids(
    taskId: string,
    nodesById: Map<string, SwarmAgentNode>,
    ctx: { phase: MissionPhase; connectivityMode: VertexConnectivityMode; swarmLoad: number },
  ): void {
    const t = this.tasks.get(taskId);
    if (!t) return;
    const active = t.bids.filter((b) => b.status === "submitted");
    for (const b of active) {
      const node = nodesById.get(b.nodeId);
      if (!node) {
        b.status = "rejected";
        continue;
      }
      if (b.battery01 + 1e-6 < t.minBattery01 || node.trust01 + 1e-6 < t.minTrust01 || b.link01 + 1e-6 < t.minConnectivity01) {
        b.status = "rejected";
        continue;
      }
      const { score, reasons } = scoreBid(t, node, b, {
        phase: ctx.phase,
        connectivityMode: ctx.connectivityMode,
        swarmLoad: ctx.swarmLoad,
        link01: b.link01,
        telemetryHealth01: Math.min(1, b.confidence01 + 0.15),
      });
      b.score = score;
      b.scoreReasons = reasons;
    }
  }

  assignWinner(taskId: string, nowMs: number): { winner?: string; fallbacks: string[]; reason?: string } {
    const t = this.tasks.get(taskId);
    if (!t) return { fallbacks: [] };
    const ranked = t.bids
      .filter((b) => b.status === "submitted" && typeof b.score === "number")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (!ranked.length) return { fallbacks: [], reason: "no_eligible_bids" };
    const winner = ranked[0].nodeId;
    const fallbacks = ranked.slice(1, 4).map((b) => b.nodeId);
    for (const b of t.bids) {
      if (b.nodeId === winner) continue;
      if (b.status === "submitted") b.status = "superseded";
    }
    t.winnerNodeId = winner;
    t.fallbackNodeIds = fallbacks;
    t.status = "assigned";
    t.commitProofHint = `assign:${taskId}:${winner}:${nowMs}`;
    return { winner, fallbacks };
  }

  markStaleBids(taskId: string, maxAgeMs: number, nowMs: number): void {
    const t = this.tasks.get(taskId);
    if (!t) return;
    for (const b of t.bids) {
      if (b.status === "submitted" && nowMs - b.submittedAtMs > maxAgeMs) b.status = "stale";
    }
  }

  reassignFromFallback(
    taskId: string,
    nodesById: Map<string, SwarmAgentNode>,
    isNodeViable: (nodeId: string) => boolean,
    nowMs: number,
  ): string | null {
    const t = this.tasks.get(taskId);
    if (!t || t.status !== "assigned" || !t.winnerNodeId) return null;
    if (isNodeViable(t.winnerNodeId)) return null;
    for (const fid of t.fallbackNodeIds) {
      if (nodesById.has(fid) && isNodeViable(fid)) {
        t.winnerNodeId = fid;
        t.commitProofHint = `reassign:${taskId}:${fid}:${nowMs}`;
        return fid;
      }
    }
    t.status = "open";
    t.winnerNodeId = undefined;
    return null;
  }

  completeTask(taskId: string): void {
    const t = this.tasks.get(taskId);
    if (t) t.status = "completed";
  }
}
