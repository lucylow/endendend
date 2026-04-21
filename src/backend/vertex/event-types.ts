/**
 * Append-only mission ledger event kinds. Vertex plane: ordering for responsibility changes.
 */

export const VERTEX_LEDGER_EVENT_TYPES = [
  "mission_created",
  "phase_transition",
  "node_join",
  "role_change",
  "target_discovered",
  "target_confirmed",
  "task_bid",
  "task_assigned",
  "task_completed",
  "task_reassigned",
  "extraction_confirmed",
  "safety_alert",
  "recovery_checkpoint",
  "blackout_entered",
  "blackout_cleared",
  "sync_reconciled",
  "local_autonomy_activated",
  "tentative_phase",
] as const;

export type VertexLedgerEventType = (typeof VERTEX_LEDGER_EVENT_TYPES)[number];

export const LATTICE_LEDGER_EVENT_TYPES = [
  "node_heartbeat",
  "node_offline",
  "capacity_score_update",
  "reputation_update",
] as const;

export type LatticeLedgerEventType = (typeof LATTICE_LEDGER_EVENT_TYPES)[number];

export const ARC_LEDGER_EVENT_TYPES = ["settlement_manifest_sealed", "proof_anchored"] as const;

export type ArcLedgerEventType = (typeof ARC_LEDGER_EVENT_TYPES)[number];

export type MissionLedgerEventType = VertexLedgerEventType | LatticeLedgerEventType | ArcLedgerEventType;

export function isVertexEvent(t: string): t is VertexLedgerEventType {
  return (VERTEX_LEDGER_EVENT_TYPES as readonly string[]).includes(t);
}
