import type { MeshPeerRuntime } from "./types";
import type { NetworkStressMode } from "./types";
import type { TaskAllocationRecord } from "./types";
import { clamp01 } from "./normalizers";

export type MeshTaskSpec = {
  taskId: string;
  kind: string;
  prefersRelay: boolean;
  scenarioHint: string;
};

export function scorePeerForTask(
  peer: MeshPeerRuntime,
  task: MeshTaskSpec,
  stress: NetworkStressMode,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0.2;
  const roleFit =
    task.prefersRelay && peer.meshRole === "relay"
      ? 0.34
      : task.kind.includes("rescue") && peer.meshRole === "rescuer"
        ? 0.32
        : task.kind.includes("scout") && peer.meshRole === "explorer"
          ? 0.28
          : 0.12;
  score += roleFit;
  reasons.push(`role_fit=${roleFit.toFixed(2)}`);
  const cap = peer.nodeKind.includes("relay") ? 0.12 : peer.nodeKind.includes("sensor") ? 0.08 : 0.06;
  score += cap;
  reasons.push(`capability=${cap.toFixed(2)}`);
  score += peer.battery01 * 0.18;
  reasons.push(`battery=${peer.battery01.toFixed(2)}`);
  const conn = clamp01(peer.reachablePeers.length / 6);
  score += conn * 0.14;
  reasons.push(`connectivity=${conn.toFixed(2)}`);
  score += peer.relayScore01 * (task.prefersRelay ? 0.22 : 0.08);
  reasons.push(`relay=${peer.relayScore01.toFixed(2)}`);
  score += peer.trust01 * 0.12;
  reasons.push(`trust=${peer.trust01.toFixed(2)}`);
  const loadPenalty = clamp01(peer.queueDepth / 10) * 0.12;
  score -= loadPenalty;
  reasons.push(`load_pen=${loadPenalty.toFixed(2)}`);
  if (stress === "partitioned" || stress === "offline") {
    score += peer.localAutonomy01 * 0.16;
    reasons.push(`autonomy_boost=${peer.localAutonomy01.toFixed(2)}`);
  }
  const latTol = clamp01(1 - peer.latencyBiasMs / 400);
  score += latTol * 0.06;
  reasons.push(`latency_tol=${latTol.toFixed(2)}`);
  if (task.scenarioHint && peer.missionNote.includes(task.scenarioHint)) {
    score += 0.05;
    reasons.push("scenario_fit");
  }
  return { score, reasons };
}

export function allocateTask(
  task: MeshTaskSpec,
  peers: MeshPeerRuntime[],
  stress: NetworkStressMode,
  nowMs: number,
): TaskAllocationRecord | null {
  const alive = peers.filter((p) => p.health !== "offline");
  if (!alive.length) return null;
  const ranked = alive
    .map((p) => ({ p, ...scorePeerForTask(p, task, stress) }))
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  const fallbacks = ranked.slice(1, 3).map((r) => r.p.peerId);
  return {
    taskId: task.taskId,
    winnerId: winner.p.peerId,
    score: winner.score,
    reasons: winner.reasons,
    fallbacks,
    atMs: nowMs,
  };
}
