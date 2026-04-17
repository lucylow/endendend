import { sha256Hex } from "@/backend/vertex/hash-chain";
import type { SettlementManifest } from "./settlement-manifest";
import { manifestCanonicalHash } from "./settlement-manifest";

/** Arc plane: public anchoring stub (no chain RPC in-repo). */
export async function anchorManifestSummary(manifest: SettlementManifest): Promise<{ chainRef: string; rootProofHash: string }> {
  const canon = manifestCanonicalHash(manifest);
  const rootProofHash = await sha256Hex(`arc|${canon}`);
  return {
    chainRef: `${manifest.arcPayload.chain}:testnet:placeholder`,
    rootProofHash,
  };
}

/** Replace with Arc / bridge SDK; stable demo tx id for judges and integration tests. */
export async function mockEmitArcBridgeTx(manifest: SettlementManifest): Promise<string> {
  const canon = manifestCanonicalHash(manifest);
  return sha256Hex(`arc_emit|${canon}`);
}
