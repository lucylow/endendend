import type { MissionPhase } from "@/backend/shared/mission-phases";
import { coerceMissionScenarioKind } from "@/backend/shared/mission-scenarios";
import {
  emptyMissionState,
  type MissionState,
  type RosterEntry,
  type SarTarget,
  type VertexConnectivityMode,
} from "@/backend/shared/mission-state";
import type { MissionLedgerEvent } from "./mission-ledger";
import type { VertexLedgerEventType } from "./event-types";
import { isVertexEvent } from "./event-types";

function asPhase(v: unknown): MissionPhase | null {
  if (typeof v !== "string") return null;
  const allowed: MissionPhase[] = [
    "init",
    "discovery",
    "search",
    "triage",
    "rescue",
    "extraction",
    "return",
    "complete",
    "aborted",
  ];
  return allowed.includes(v as MissionPhase) ? (v as MissionPhase) : null;
}

/** Fold Vertex (and selected cross-plane) events into ``MissionState`` — authoritative replay. */
export function replayMissionFromLedger(events: MissionLedgerEvent[], missionId: string): MissionState {
  const first = events.find((e) => e.missionId === missionId && e.eventType === "mission_created");
  const t0 = first?.timestamp ?? Date.now();
  let state = emptyMissionState(missionId, t0);

  for (const e of events) {
    if (e.missionId !== missionId) continue;
    state = applyOne(state, e);
  }
  return state;
}

/** Apply one append-only row to ``MissionState`` (same rules as ``replayMissionFromLedger``). */
export function applyMissionLedgerEvent(state: MissionState, e: MissionLedgerEvent): MissionState {
  if (e.missionId !== state.missionId) return state;
  return applyOne(state, e);
}

function applyOne(state: MissionState, e: MissionLedgerEvent): MissionState {
  const next = { ...state, updatedAtMs: Math.max(state.updatedAtMs, e.timestamp) };
  next.consensusPointer = {
    sequence: state.consensusPointer.sequence + 1,
    lastEventHash: e.eventHash,
  };

  if (e.plane === "vertex" && isVertexEvent(e.eventType)) {
    return applyVertex(next, e.eventType as VertexLedgerEventType, e);
  }
  if (e.eventType === "node_heartbeat" && e.plane === "lattice") {
    const nodeId = String(e.payload.nodeId ?? "");
    if (nodeId && next.roster[nodeId]) {
      next.roster = {
        ...next.roster,
        [nodeId]: { ...next.roster[nodeId], joinedAtMs: next.roster[nodeId].joinedAtMs },
      };
    }
  }
  return next;
}

function applyVertex(state: MissionState, type: VertexLedgerEventType, e: MissionLedgerEvent): MissionState {
  switch (type) {
    case "mission_created": {
      const cells = Number(e.payload.cellsKnown ?? 0);
      const scenario = coerceMissionScenarioKind(
        typeof e.payload.scenario === "string" ? e.payload.scenario : undefined,
      );
      return {
        ...state,
        phase: asPhase(e.payload.phase) ?? "init",
        ...(scenario ? { scenario } : {}),
        mapSummary: { ...state.mapSummary, ...(Number.isFinite(cells) && cells > 0 ? { cellsKnown: cells } : {}) },
      };
    }
    case "phase_transition": {
      const to = asPhase(e.payload.toPhase);
      const cells = Number(e.payload.cellsKnown ?? NaN);
      const mapPatch =
        Number.isFinite(cells) && cells >= 0
          ? { mapSummary: { ...state.mapSummary, cellsKnown: Math.max(state.mapSummary.cellsKnown ?? 0, Math.floor(cells)) } }
          : {};
      return to ? { ...state, phase: to, ...mapPatch } : state;
    }
    case "node_join": {
      const nodeId = String(e.payload.nodeId ?? "");
      if (!nodeId) return state;
      const entry: RosterEntry = {
        nodeId,
        role: (e.payload.role as RosterEntry["role"]) ?? "observer",
        joinedAtMs: e.timestamp,
        capabilities: Array.isArray(e.payload.capabilities) ? (e.payload.capabilities as string[]) : [],
      };
      return { ...state, roster: { ...state.roster, [nodeId]: entry } };
    }
    case "role_change": {
      const nodeId = String(e.payload.nodeId ?? "");
      const role = e.payload.role as RosterEntry["role"] | undefined;
      if (!nodeId || !role || !state.roster[nodeId]) return state;
      return {
        ...state,
        roster: { ...state.roster, [nodeId]: { ...state.roster[nodeId], role } },
      };
    }
    case "target_discovered": {
      const targetId = String(e.payload.targetId ?? "");
      if (!targetId) return state;
      const t: SarTarget = {
        targetId,
        discoveredBy: e.actorId,
        confirmedByVertex: false,
        notes: String(e.payload.notes ?? ""),
      };
      return { ...state, targets: { ...state.targets, [targetId]: t } };
    }
    case "target_confirmed": {
      const targetId = String(e.payload.targetId ?? "");
      if (!targetId || !state.targets[targetId]) return state;
      return {
        ...state,
        targets: {
          ...state.targets,
          [targetId]: { ...state.targets[targetId], confirmedByVertex: true },
        },
      };
    }
    case "task_bid":
      return state;
    case "task_assigned": {
      const taskId = String(e.payload.taskId ?? "");
      const nodeId = String(e.payload.nodeId ?? "");
      if (!taskId || !nodeId) return state;
      return {
        ...state,
        assignments: {
          ...state.assignments,
          [taskId]: { taskId, nodeId, taskType: String(e.payload.taskType ?? "generic"), assignedAtMs: e.timestamp },
        },
      };
    }
    case "task_reassigned": {
      const taskId = String(e.payload.taskId ?? "");
      const nodeId = String(e.payload.newNodeId ?? e.payload.nodeId ?? "");
      if (!taskId || !nodeId) return state;
      return {
        ...state,
        assignments: {
          ...state.assignments,
          [taskId]: { taskId, nodeId, taskType: String(e.payload.taskType ?? "generic"), assignedAtMs: e.timestamp },
        },
      };
    }
    case "task_completed": {
      const taskId = String(e.payload.taskId ?? "");
      if (!taskId) return state;
      const assignments = { ...state.assignments };
      delete assignments[taskId];
      const done = new Set(state.completedTaskIds ?? []);
      done.add(taskId);
      return { ...state, assignments, completedTaskIds: [...done] };
    }
    case "blackout_entered": {
      const mode = e.payload.mode as VertexConnectivityMode | undefined;
      return {
        ...state,
        connectivityMode: mode ?? "blackout",
      };
    }
    case "blackout_cleared": {
      return { ...state, connectivityMode: "recovery" };
    }
    case "sync_reconciled": {
      return { ...state, connectivityMode: "normal" };
    }
    case "local_autonomy_activated":
    case "tentative_phase":
      return state;
    case "extraction_confirmed": {
      const targetId = String(e.payload.targetId ?? "");
      if (targetId && state.targets[targetId]) {
        return {
          ...state,
          targets: {
            ...state.targets,
            [targetId]: { ...state.targets[targetId], notes: `${state.targets[targetId].notes ?? ""} extraction_ok` },
          },
        };
      }
      return state;
    }
    case "safety_alert": {
      const alertId = String(e.payload.alertId ?? e.eventHash.slice(0, 12));
      return {
        ...state,
        alerts: [
          ...state.alerts,
          {
            alertId,
            level: (e.payload.level as "info" | "warn" | "critical") ?? "warn",
            message: String(e.payload.message ?? ""),
            raisedAtMs: e.timestamp,
            sourceNodeId: e.actorId,
          },
        ],
      };
    }
    case "recovery_checkpoint": {
      const label = String(e.payload.label ?? e.eventHash);
      return { ...state, recoveryCheckpoints: [...state.recoveryCheckpoints, label] };
    }
    default:
      return state;
  }
}
