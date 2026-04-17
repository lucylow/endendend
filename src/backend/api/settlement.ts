import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { buildSettlementManifest } from "@/backend/arc/settlement-manifest";
import { buildRewardManifest, type RewardManifestRecord } from "@/backend/arc/reward-manifest";
import { anchorManifestSummary, mockEmitArcBridgeTx } from "@/backend/arc/proof-anchor";
import { EventLogger } from "@/backend/observability/event-logger";

export type ArcSettlementResult = {
  manifest: Awaited<ReturnType<typeof buildSettlementManifest>>;
  rewardManifest: RewardManifestRecord;
  anchor: { chainRef: string; rootProofHash: string };
  /** Deterministic placeholder until a real Arc / Hedera / EVM submit is wired. */
  mockBridgeTxHash: string;
  envelopePatch: Pick<TashiStateEnvelope, "arc" | "settlement">;
};

/** Arc slow-path: only after mission completion (or aborted) for public audit bundle. */
export async function sealArcSettlement(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  nowMs: number,
): Promise<ArcSettlementResult | { error: string }> {
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  if (mission.phase !== "complete" && mission.phase !== "aborted") {
    return { error: "mission_not_terminal" };
  }
  const head = ledger.head();
  const root = head?.eventHash ?? "genesis";
  const manifest = await buildSettlementManifest(mission, ledger.toArray(), registry, {
    manifestId: `manifest-${missionId}-${nowMs}`,
    sealedAtMs: nowMs,
    ledgerRootHash: root,
    outcome: mission.phase === "complete" ? "success" : "aborted",
  });
  const rewardManifest = await buildRewardManifest(
    ledger,
    registry,
    missionId,
    nowMs,
    mission.scenario ?? "collapsed_building",
  );
  const anchor = await anchorManifestSummary(manifest);
  const mockBridgeTxHash = await mockEmitArcBridgeTx(manifest);
  EventLogger.settlementQueued(rewardManifest.arcSettlement.txPayloadHash, missionId, {
    manifestId: manifest.manifestId,
    rewardMerkleRoot: rewardManifest.verification.merkleProofRoot,
  });
  await ledger.append({
    missionId,
    actorId: "arc-settlement",
    eventType: "settlement_manifest_sealed",
    plane: "arc",
    payload: {
      manifestId: manifest.manifestId,
      ledgerRootHash: root,
      evidenceBundleHash: manifest.evidenceBundleHash,
      proofMerkleRoot: manifest.arcPayload.proofMerkleRoot,
      rewardMerkleRoot: rewardManifest.verification.merkleProofRoot,
      rewardSafetyEvents: rewardManifest.verification.safetyEventsIncluded,
      rewardTotalPool: rewardManifest.totalPool,
    },
    timestamp: nowMs + 1,
    previousHash: ledger.tailHash(),
  });
  await ledger.append({
    missionId,
    actorId: "arc-settlement",
    eventType: "proof_anchored",
    plane: "arc",
    payload: { chainRef: anchor.chainRef, rootProofHash: anchor.rootProofHash, mockBridgeTxHash },
    timestamp: nowMs + 2,
    previousHash: ledger.tailHash(),
  });
  return {
    manifest,
    rewardManifest,
    anchor,
    mockBridgeTxHash,
    envelopePatch: {
      arc: {
        manifestId: manifest.manifestId,
        anchoredAtMs: nowMs,
        chainRef: anchor.chainRef,
        rootProofHash: anchor.rootProofHash,
        evidenceBundleHash: manifest.evidenceBundleHash,
        evidenceMerkleRoot: manifest.evidenceMerkleRoot,
        settlementAmount: manifest.arcPayload.settlementAmount,
        proofMerkleRoot: manifest.arcPayload.proofMerkleRoot,
        mockBridgeTxHash,
      },
      settlement: manifest,
    },
  };
}
