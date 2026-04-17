import type { MissionState } from "@/backend/shared/mission-state";
import { stableStringify } from "@/backend/vertex/hash-chain";

export type ContributionLine = {
  nodeId: string;
  role: string;
  validatedEvents: number;
  proofHashes: string[];
};

export type SettlementManifest = {
  manifestId: string;
  missionId: string;
  outcome: string;
  contributions: ContributionLine[];
  ledgerRootHash: string;
  sealedAtMs: number;
  summary: Record<string, unknown>;
};

export function buildSettlementManifest(
  mission: MissionState,
  opts: { manifestId: string; sealedAtMs: number; ledgerRootHash: string; outcome: string },
): SettlementManifest {
  const contributions: ContributionLine[] = Object.values(mission.roster).map((r) => ({
    nodeId: r.nodeId,
    role: r.role,
    validatedEvents: 0,
    proofHashes: [opts.ledgerRootHash],
  }));
  return {
    manifestId: opts.manifestId,
    missionId: mission.missionId,
    outcome: opts.outcome,
    contributions,
    ledgerRootHash: opts.ledgerRootHash,
    sealedAtMs: opts.sealedAtMs,
    summary: {
      phase: mission.phase,
      targets: Object.keys(mission.targets).length,
      assignments: Object.keys(mission.assignments).length,
      alerts: mission.alerts.length,
    },
  };
}

export function manifestCanonicalHash(m: SettlementManifest): string {
  return stableStringify({
    manifestId: m.manifestId,
    missionId: m.missionId,
    outcome: m.outcome,
    ledgerRootHash: m.ledgerRootHash,
    contributions: m.contributions,
  });
}
