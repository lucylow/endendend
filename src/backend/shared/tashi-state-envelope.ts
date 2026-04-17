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

/**
 * Single stable contract for UI and integration tests: Vertex truth inside ``mission``,
 * Lattice membership snapshot, Arc only when settling.
 */
export type TashiStateEnvelope = {
  mission: MissionState;
  vertex: VertexProofSummary;
  lattice: LatticeValidationSnapshot;
  arc?: ArcSettlementMeta;
};
