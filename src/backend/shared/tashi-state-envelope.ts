import type { SettlementManifest } from "@/backend/arc/settlement-manifest";
import type { AllocationScore } from "@/backend/lattice/allocation-policies";
import type { RecoveryReport } from "@/backend/recovery/recovery-manager";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";
import type { MissionScenarioKind } from "./mission-scenarios";
import type { MissionPolicy } from "./mission-policy";
import type { MissionState } from "./mission-state";

export type VertexProofSummary = {
  lastCommittedHash: string;
  sequence: number;
  /** Optional multi-signer ids that acknowledged ordering (demo / extension). */
  quorumNodeIds?: string[];
};

export type LatticeValidationSnapshot = {
  capturedAtMs: number;
  onlineNodeIds: string[];
  trustScores: Record<string, number>;
  capacityHints: Record<string, number>;
};

export type ArcSettlementMeta = {
  manifestId: string;
  anchoredAtMs?: number;
  chainRef?: string;
  rootProofHash?: string;
  evidenceBundleHash?: string;
  evidenceMerkleRoot?: string;
  settlementAmount?: string;
  proofMerkleRoot?: string;
  mockBridgeTxHash?: string;
};

export type EnvelopeMapTarget = {
  id: string;
  status: string;
  confidence: number;
};

export type EnvelopeTask = {
  id: string;
  type: string;
  assignee?: string;
  status: "pending" | "assigned" | "complete";
};

export type EnvelopeAlert = {
  type: string;
  severity: "warning" | "critical";
  nodeId: string;
};

export type SwarmHealthSlice = {
  onlineNodes: number;
  avgReputation: number;
  batteryCritical: number;
};

/**
 * Single stable contract for UI and integration tests: Vertex truth inside ``mission``,
 * Lattice membership snapshot, Arc only when settling.
 *
 * Optional SAR projection fields (`policy`, `mapOverview`, …) populate when the mission
 * carries a ``scenario`` (from ``mission_created``) so the frontend can stay scenario-agnostic.
 */
export type TashiStateEnvelope = {
  mission: MissionState;
  vertex: VertexProofSummary;
  lattice: LatticeValidationSnapshot;
  arc?: ArcSettlementMeta;
  policy?: MissionPolicy;
  budgetCompliance?: boolean;
  ledgerTail?: MissionLedgerEvent;
  consensusProofs?: string[];
  mapOverview?: {
    exploredCells: number;
    coveragePercent: number;
    targets: EnvelopeMapTarget[];
  };
  activeTasks?: EnvelopeTask[];
  alertStream?: EnvelopeAlert[];
  swarmHealth?: SwarmHealthSlice;
  /** Full Arc manifest once sealed (alongside summarized ``arc`` meta). */
  settlement?: SettlementManifest;
  replayRoot?: string;
  syncStatus?: "synced" | "catching_up" | "stale";
  /** Vertex SAR recovery semantics for operator dashboards. */
  recovery?: { reports: RecoveryReport[]; aggregateHeadline: string };
  /** Deterministic Lattice ranking preview for the active scenario. */
  allocationPreview?: {
    taskType: string;
    scenario: MissionScenarioKind;
    ranked: AllocationScore[];
    topExplanation: string;
  };
  envelopeVersion?: number;
  capturedAtMs?: number;
};
