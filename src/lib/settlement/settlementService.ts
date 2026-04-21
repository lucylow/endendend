import { sealArcSettlement, type ArcSettlementResult } from "@/backend/api/settlement";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { SettlementActionResult } from "./types";

export type SettlementSealOk = { ok: true; mockTxHash?: string; envelopePatch: ArcSettlementResult["envelopePatch"] };

export async function runSettlementSeal(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
): Promise<SettlementActionResult | SettlementSealOk> {
  try {
    const res = await sealArcSettlement(ledger, registry, missionId, Date.now());
    if ("error" in res) return { ok: false, error: res.error };
    return { ok: true, mockTxHash: res.mockBridgeTxHash, envelopePatch: res.envelopePatch };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "settlement_failed" };
  }
}
