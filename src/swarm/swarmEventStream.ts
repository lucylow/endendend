import type { VertexSimEvent } from "@/backend/vertex/vertex-event-bus";

export type SwarmRuntimeEventKind =
  | "tick"
  | "peer_signal"
  | "mesh"
  | "task"
  | "target"
  | "role"
  | "ledger"
  | "map";

export type SwarmRuntimeEvent = {
  id: string;
  atMs: number;
  kind: SwarmRuntimeEventKind;
  label: string;
  detail?: string;
  raw?: VertexSimEvent;
};

let evId = 1;

function nextId(): string {
  return `swarm-ev-${evId++}`;
}

/** Map low-level bus events to human-readable swarm timeline rows. */
export function vertexSimEventToRuntime(ev: VertexSimEvent, nowMs: number): SwarmRuntimeEvent | null {
  switch (ev.type) {
    case "tick":
      return { id: nextId(), atMs: ev.nowMs, kind: "tick", label: "sim_tick", detail: String(ev.nowMs) };
    case "telemetry":
      return {
        id: nextId(),
        atMs: ev.sample.receivedAtMs,
        kind: "peer_signal",
        label: "heartbeat",
        detail: `${ev.sample.nodeId} seq=${ev.sample.sequence}`,
        raw: ev,
      };
    case "connectivity":
      return { id: nextId(), atMs: nowMs, kind: "mesh", label: "connectivity_mode", detail: ev.mode, raw: ev };
    case "task_opened":
      return { id: nextId(), atMs: nowMs, kind: "task", label: "task_opened", detail: ev.taskId, raw: ev };
    case "task_assigned":
      return {
        id: nextId(),
        atMs: nowMs,
        kind: "task",
        label: "task_assigned",
        detail: `${ev.taskId} → ${ev.nodeId}`,
        raw: ev,
      };
    case "ledger_committed":
      return { id: nextId(), atMs: nowMs, kind: "ledger", label: ev.eventType, detail: ev.eventHash.slice(0, 12), raw: ev };
    case "blackout":
      return {
        id: nextId(),
        atMs: nowMs,
        kind: "mesh",
        label: ev.active ? "partition_stress" : "mesh_recovered",
        detail: ev.severity,
        raw: ev,
      };
    case "recovery":
      return { id: nextId(), atMs: nowMs, kind: "mesh", label: "recovery", detail: ev.message, raw: ev };
    case "map_updated":
      return {
        id: nextId(),
        atMs: nowMs,
        kind: "map",
        label: "map_updated",
        detail: `cov=${(ev.coverage01 * 100).toFixed(0)}% frontier=${ev.frontier}`,
        raw: ev,
      };
    case "target_candidate":
      return { id: nextId(), atMs: nowMs, kind: "target", label: "target_candidate", detail: ev.candidateId, raw: ev };
    case "target_confirmed_bus":
      return { id: nextId(), atMs: nowMs, kind: "target", label: "target_confirmed", detail: ev.candidateId, raw: ev };
    case "role_handoff":
      return {
        id: nextId(),
        atMs: nowMs,
        kind: "role",
        label: "role_handoff",
        detail: `${ev.nodeId} → ${ev.toRole} (${ev.reason})`,
        raw: ev,
      };
    case "foxmq_sync":
      return {
        id: nextId(),
        atMs: nowMs,
        kind: "map",
        label: "foxmq_collective_sync",
        detail: `v${ev.mapVersion} dirty=${ev.dirtyDeltas} lag=${ev.syncLagMs}ms buf=${ev.partitionBuffer}`,
        raw: ev,
      };
    default:
      return null;
  }
}

export function filterEventsByWindow(events: SwarmRuntimeEvent[], fromMs: number, toMs: number): SwarmRuntimeEvent[] {
  return events.filter((e) => e.atMs >= fromMs && e.atMs <= toMs);
}
