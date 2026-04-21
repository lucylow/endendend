import type { MissionPhase } from "@/backend/shared/mission-phases";
import { validVertexNextPhases } from "@/backend/shared/mission-phases";
import { EventLogger } from "@/backend/observability/event-logger";
import { MissionLedger, type ControlPlane, type MissionLedgerEvent } from "./mission-ledger";

export type VertexSuggestion = {
  missionId: string;
  actorId: string;
  eventType: MissionLedgerEvent["eventType"];
  plane: Extract<ControlPlane, "vertex">;
  payload: Record<string, unknown>;
  timestamp: number;
};

/** Local inference / UI intent — not authoritative until ``commitVertexBatch``. */
export function suggestPhaseTransition(
  missionId: string,
  actorId: string,
  fromPhase: MissionPhase,
  toPhase: MissionPhase,
  nowMs: number,
  /** Optional fields merged into the Vertex payload (e.g. ``cellsKnown`` for map sync). */
  extraPayload?: Record<string, unknown>,
): VertexSuggestion | { error: string } {
  const allowed = validVertexNextPhases(fromPhase);
  if (!allowed.includes(toPhase)) return { error: `invalid_transition:${fromPhase}->${toPhase}` };
  return {
    missionId,
    actorId,
    eventType: "phase_transition",
    plane: "vertex",
    payload: { fromPhase, toPhase, ...extraPayload },
    timestamp: nowMs,
  };
}

export function suggestTargetDiscovery(
  missionId: string,
  actorId: string,
  targetId: string,
  nowMs: number,
  notes?: string,
): VertexSuggestion {
  return {
    missionId,
    actorId,
    eventType: "target_discovered",
    plane: "vertex",
    payload: { targetId, notes: notes ?? "" },
    timestamp: nowMs,
  };
}

export function suggestTaskAssignment(
  missionId: string,
  actorId: string,
  taskId: string,
  nodeId: string,
  taskType: string,
  nowMs: number,
): VertexSuggestion {
  return {
    missionId,
    actorId,
    eventType: "task_assigned",
    plane: "vertex",
    payload: { taskId, nodeId, taskType },
    timestamp: nowMs,
  };
}

export function suggestRecoveryCheckpoint(
  missionId: string,
  actorId: string,
  label: string,
  nowMs: number,
  extra?: Record<string, unknown>,
): VertexSuggestion {
  return {
    missionId,
    actorId,
    eventType: "recovery_checkpoint",
    plane: "vertex",
    payload: extra ? { label, ...extra } : { label },
    timestamp: nowMs,
  };
}

function suggestionKey(s: VertexSuggestion): string {
  return `${s.timestamp}\0${s.actorId}\0${s.eventType}\0${stableOrderPayload(s.payload)}`;
}

function stableOrderPayload(p: Record<string, unknown>): string {
  return JSON.stringify(p, Object.keys(p).sort());
}

/**
 * Deterministic Vertex ordering: sort suggestions by (timestamp, actorId, eventType, payload).
 * Appends each as a Vertex ledger event with correct ``previousHash``.
 */
export async function commitVertexBatch(ledger: MissionLedger, suggestions: VertexSuggestion[]): Promise<MissionLedgerEvent[]> {
  const sorted = [...suggestions].sort((a, b) => {
    const ka = suggestionKey(a);
    const kb = suggestionKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const committed: MissionLedgerEvent[] = [];
  for (const s of sorted) {
    const ev = await ledger.append({
      missionId: s.missionId,
      actorId: s.actorId,
      eventType: s.eventType,
      plane: "vertex",
      payload: s.payload,
      timestamp: s.timestamp,
      previousHash: ledger.tailHash(),
    });
    EventLogger.vertexOrdered(ev);
    committed.push(ev);
  }
  return committed;
}
