import type { MissionState } from "@/backend/shared/mission-state";
import { buildEvidenceBundle } from "@/backend/arc/evidence-bundle";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { merkleRootHex, sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

export type ContributionLine = {
  nodeId: string;
  role: string;
  validatedEvents: number;
  proofHashes: string[];
};

export type RewardContributionLine = {
  nodeId: string;
  contributions: Array<{ eventType: string; proofHash: string; value: number }>;
  /** Weighted score-units after Lattice trust (not on-chain currency until bridged). */
  totalReward: string;
  latticeScore: number;
};

export type MissionCertificate = {
  targetsFound: number;
  extractions: number;
  coveragePercent: number;
  safetyEvents: number;
};

export type ArcSettlementPayload = {
  chain: "hedera" | "ethereum" | "solana";
  settlementAmount: string;
  proofMerkleRoot: string;
};

export type SettlementManifest = {
  manifestId: string;
  missionId: string;
  outcome: string;
  phase: MissionState["phase"];
  contributions: ContributionLine[];
  ledgerRootHash: string;
  ledgerTailHash: string;
  sealedAtMs: number;
  summary: Record<string, unknown>;
  evidenceBundleHash: string;
  evidenceMerkleRoot: string;
  nodeContributions: RewardContributionLine[];
  missionCertificate: MissionCertificate;
  arcPayload: ArcSettlementPayload;
};

function contributionWeight(eventType: string): number {
  switch (eventType) {
    case "target_discovered":
      return 10;
    case "target_confirmed":
      return 15;
    case "extraction_confirmed":
      return 50;
    case "safety_alert":
      return 20;
    case "task_assigned":
      return 4;
    case "recovery_checkpoint":
      return 6;
    default:
      return 0;
  }
}

function missionEvents(missionId: string, ledgerEvents: MissionLedgerEvent[]): MissionLedgerEvent[] {
  return ledgerEvents.filter((e) => e.missionId === missionId);
}

function computeCertificate(mission: MissionState, ledgerEvents: MissionLedgerEvent[]): MissionCertificate {
  const mine = missionEvents(mission.missionId, ledgerEvents);
  const extractions = mine.filter((e) => e.eventType === "extraction_confirmed").length;
  const safetyEvents = mission.alerts.length;
  const cells = mission.mapSummary.cellsKnown ?? 0;
  const coveragePercent = Math.min(100, Math.round(cells > 0 ? Math.min(100, 8 + Math.sqrt(cells) * 4) : 0));

  return {
    targetsFound: Object.keys(mission.targets).length,
    extractions,
    coveragePercent,
    safetyEvents,
  };
}

async function computeRewardClaims(
  missionId: string,
  ledgerEvents: MissionLedgerEvent[],
  registry: NodeRegistry,
): Promise<RewardContributionLine[]> {
  const byNode: Record<
    string,
    { contributions: RewardContributionLine["contributions"]; latticeScore: number }
  > = {};

  for (const event of ledgerEvents) {
    if (event.missionId !== missionId) continue;
    if (event.plane === "arc") continue;

    const w = contributionWeight(event.eventType);
    if (w <= 0) continue;

    const nodeId = event.actorId;
    if (!byNode[nodeId]) {
      byNode[nodeId] = {
        contributions: [],
        latticeScore: registry.latticeTrust01(nodeId),
      };
    }
    byNode[nodeId].contributions.push({
      eventType: event.eventType,
      proofHash: event.eventHash,
      value: w,
    });
  }

  return Object.entries(byNode)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nodeId, row]) => {
      const raw = row.contributions.reduce((s, c) => s + c.value, 0);
      const weighted = raw * row.latticeScore;
      return {
        nodeId,
        contributions: row.contributions,
        totalReward: weighted.toFixed(4),
        latticeScore: row.latticeScore,
      };
    });
}

function legacyContributions(
  mission: MissionState,
  claims: RewardContributionLine[],
  ledgerTailHash: string,
): ContributionLine[] {
  const proofByNode = new Map<string, string[]>();
  const counts = new Map<string, number>();
  for (const c of claims) {
    proofByNode.set(
      c.nodeId,
      c.contributions.map((x) => x.proofHash),
    );
    counts.set(c.nodeId, c.contributions.length);
  }

  return Object.values(mission.roster).map((r) => ({
    nodeId: r.nodeId,
    role: r.role,
    validatedEvents: counts.get(r.nodeId) ?? 0,
    proofHashes: proofByNode.get(r.nodeId)?.length ? (proofByNode.get(r.nodeId) as string[]) : [ledgerTailHash],
  }));
}

function totalRewardUnits(claims: RewardContributionLine[]): number {
  return claims.reduce((sum, c) => sum + Number.parseFloat(c.totalReward || "0"), 0);
}

export async function buildSettlementManifest(
  mission: MissionState,
  ledgerEvents: MissionLedgerEvent[],
  registry: NodeRegistry,
  opts: { manifestId: string; sealedAtMs: number; ledgerRootHash: string; outcome: string },
): Promise<SettlementManifest> {
  const tail = opts.ledgerRootHash;
  const evidence = await buildEvidenceBundle(mission.missionId, ledgerEvents, registry);
  const nodeContributions = await computeRewardClaims(mission.missionId, ledgerEvents, registry);

  const contribLeaves = await Promise.all(
    nodeContributions.flatMap((c) =>
      c.contributions.map((row) =>
        sha256Hex(stableStringify({ nodeId: c.nodeId, eventType: row.eventType, proofHash: row.proofHash, value: row.value })),
      ),
    ),
  );
  const proofMerkleRoot = await merkleRootHex(contribLeaves.length ? contribLeaves : [await sha256Hex("contributions|empty")]);

  const grand = totalRewardUnits(nodeContributions);
  const certificate = computeCertificate(mission, ledgerEvents);

  const manifest: SettlementManifest = {
    manifestId: opts.manifestId,
    missionId: mission.missionId,
    outcome: opts.outcome,
    phase: mission.phase,
    contributions: legacyContributions(mission, nodeContributions, tail),
    ledgerRootHash: opts.ledgerRootHash,
    ledgerTailHash: tail,
    sealedAtMs: opts.sealedAtMs,
    summary: {
      phase: mission.phase,
      targets: Object.keys(mission.targets).length,
      assignments: Object.keys(mission.assignments).length,
      alerts: mission.alerts.length,
      evidenceItems: evidence.items.length,
    },
    evidenceBundleHash: evidence.bundleHash,
    evidenceMerkleRoot: evidence.merkleRoot,
    nodeContributions,
    missionCertificate: certificate,
    arcPayload: {
      chain: "hedera",
      settlementAmount: `${grand.toFixed(4)} score-units`,
      proofMerkleRoot,
    },
  };

  return manifest;
}

export function manifestCanonicalHash(m: SettlementManifest): string {
  return stableStringify({
    manifestId: m.manifestId,
    missionId: m.missionId,
    outcome: m.outcome,
    phase: m.phase,
    ledgerRootHash: m.ledgerRootHash,
    ledgerTailHash: m.ledgerTailHash,
    contributions: m.contributions,
    evidenceBundleHash: m.evidenceBundleHash,
    evidenceMerkleRoot: m.evidenceMerkleRoot,
    nodeContributions: m.nodeContributions,
    missionCertificate: m.missionCertificate,
    arcPayload: m.arcPayload,
  });
}
