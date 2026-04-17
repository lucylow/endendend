import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import { buildSettlementManifest } from "@/backend/arc/settlement-manifest";
import { anchorManifestSummary } from "@/backend/arc/proof-anchor";

export type ArcSettlementResult = {
  manifest: ReturnType<typeof buildSettlementManifest>;
  anchor: { chainRef: string; rootProofHash: string };
  envelopePatch: Pick<TashiStateEnvelope, "arc">;
};

/** Arc slow-path: only after mission completion (or aborted) for public audit bundle. */
export async function sealArcSettlement(
  ledger: MissionLedger,
  missionId: string,
  nowMs: number,
): Promise<ArcSettlementResult | { error: string }> {
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  if (mission.phase !== "complete" && mission.phase !== "aborted") {
    return { error: "mission_not_terminal" };
  }
  const head = ledger.head();
  const root = head?.eventHash ?? "genesis";
  const manifest = buildSettlementManifest(mission, {
    manifestId: `manifest-${missionId}-${nowMs}`,
    sealedAtMs: nowMs,
    ledgerRootHash: root,
    outcome: mission.phase === "complete" ? "success" : "aborted",
  });
  const anchor = await anchorManifestSummary(manifest);
  await ledger.append({
    missionId,
    actorId: "arc-settlement",
    eventType: "settlement_manifest_sealed",
    plane: "arc",
    payload: { manifestId: manifest.manifestId, ledgerRootHash: root },
    timestamp: nowMs + 1,
    previousHash: ledger.tailHash(),
  });
  await ledger.append({
    missionId,
    actorId: "arc-settlement",
    eventType: "proof_anchored",
    plane: "arc",
    payload: { chainRef: anchor.chainRef, rootProofHash: anchor.rootProofHash },
    timestamp: nowMs + 2,
    previousHash: ledger.tailHash(),
  });
  return {
    manifest,
    anchor,
    envelopePatch: {
      arc: {
        manifestId: manifest.manifestId,
        anchoredAtMs: nowMs,
        chainRef: anchor.chainRef,
        rootProofHash: anchor.rootProofHash,
      },
    },
  };
}
