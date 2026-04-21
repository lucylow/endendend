import type { MissionNodeRole } from "@/backend/shared/mission-state";

/** Monotonic map cell states — merge precedence in `@/foxmq/mapMerge`. */
export type MapCellState =
  | "unknown"
  | "frontier"
  | "seen"
  | "searched"
  | "blocked"
  | "target"
  | "safe"
  | "hazard"
  | "relay_critical"
  | "unreachable";

export type MapProofSource = "local_sensor" | "peer_mesh" | "peer_confirm" | "replay" | "recovery" | "operator";

export type MapCellMeta = {
  state: MapCellState;
  /** Lamport-style version for deterministic merge. */
  version: number;
  updatedAtMs: number;
  lastNodeId?: string;
  /** Highest sensor confidence observed for this cell. */
  confidence01?: number;
  firstSeenBy?: string;
  proofSource?: MapProofSource;
  /** Local node has unpublished mesh commits (FoxMQ-style). */
  dirtyLocal?: boolean;
  /** Short audit trail of merge origins (cap in merge engine). */
  mergeLineage?: string[];
};

export type MapCoord = { gx: number; gz: number };

export type SharedMapDelta = {
  cells: Record<string, MapCellMeta>;
  originNodeId: string;
  emittedAtMs: number;
};

export type SensorEvidenceKind =
  | "thermal"
  | "optical"
  | "ir"
  | "audio"
  | "gas"
  | "lidar_shape"
  | "operator_note"
  | "peer_confirm"
  | "replay_artifact";

export type TargetEvidence = {
  id: string;
  sensor: SensorEvidenceKind;
  confidence01: number;
  nodeId: string;
  atMs: number;
  note?: string;
};

export type TargetCandidate = {
  candidateId: string;
  missionId: string;
  gx: number;
  gz: number;
  world: { x: number; y: number; z: number };
  evidence: TargetEvidence[];
  mergedConfidence01: number;
  status: "candidate" | "confirmed";
  confirmedByNodeId?: string;
  /** Human-readable merge trace for UI / audit. */
  trustExplanation: string[];
};

export type RoleHandoffRecord = {
  atMs: number;
  nodeId: string;
  fromRole: MissionNodeRole;
  toRole: MissionNodeRole;
  reason: string;
  evidence: string;
};

export type ExplorationAssignment = {
  nodeId: string;
  frontierKeys: string[];
  sectorLabel: string;
};

export type NodeExplorationState = {
  nodeId: string;
  cellsVisitedThisTick: number;
  assignment: ExplorationAssignment | null;
};
