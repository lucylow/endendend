import type { MissionPhase } from "./mission-phases";
import type { MissionScenarioKind } from "./mission-scenarios";

/** Operator / mesh health as committed or derived from Vertex ledger (blackout / recovery). */
export type VertexConnectivityMode =
  | "normal"
  | "degraded"
  | "partial_partition"
  | "blackout"
  | "recovery"
  | "resync";

export type MissionNodeRole = "explorer" | "relay" | "carrier" | "medic" | "observer";

export type RosterEntry = {
  nodeId: string;
  role: MissionNodeRole;
  joinedAtMs: number;
  capabilities: string[];
};

export type SarTarget = {
  targetId: string;
  discoveredBy?: string;
  confirmedByVertex?: boolean;
  notes?: string;
};

export type TaskAssignment = {
  taskId: string;
  nodeId: string;
  taskType: string;
  assignedAtMs: number;
};

export type SafetyAlert = {
  alertId: string;
  level: "info" | "warn" | "critical";
  message: string;
  raisedAtMs: number;
  sourceNodeId?: string;
};

export type MapSummary = {
  cellsKnown: number;
  lastMergedVersion?: number;
  bbox?: { min: [number, number]; max: [number, number] };
};

/** Canonical mission read model — reconstruct from ledger + latest Lattice snapshot fields. */
export type MissionState = {
  missionId: string;
  phase: MissionPhase;
  /** Set from ``mission_created`` payload when present — drives policy + Lattice budget defaults. */
  scenario?: MissionScenarioKind;
  createdAtMs: number;
  updatedAtMs: number;
  roster: Record<string, RosterEntry>;
  targets: Record<string, SarTarget>;
  assignments: Record<string, TaskAssignment>;
  mapSummary: MapSummary;
  alerts: SafetyAlert[];
  /** Monotonic Vertex ordering pointer — last committed ledger event hash + sequence. */
  consensusPointer: { sequence: number; lastEventHash: string };
  recoveryCheckpoints: string[];
  /** Last committed connectivity regime (Vertex 2 — blackout / recovery ledger events). */
  connectivityMode?: VertexConnectivityMode;
  /** Task IDs completed per ledger ``task_completed`` rows. */
  completedTaskIds: string[];
};

export function emptyMissionState(missionId: string, nowMs: number): MissionState {
  return {
    missionId,
    phase: "init",
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    roster: {},
    targets: {},
    assignments: {},
    mapSummary: { cellsKnown: 0 },
    alerts: [],
    consensusPointer: { sequence: 0, lastEventHash: "genesis" },
    recoveryCheckpoints: [],
    connectivityMode: "normal",
    completedTaskIds: [],
  };
}
