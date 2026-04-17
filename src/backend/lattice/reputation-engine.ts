/** Lightweight Lattice reputation adjustments (deterministic, local demo). */

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
