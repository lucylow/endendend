import { sha256Hex } from "@/backend/vertex/hash-chain";
import type { SettlementManifest } from "./settlement-manifest";
import { manifestCanonicalHash } from "./settlement-manifest";

/** Arc plane: public anchoring stub (no chain RPC in-repo). */
export async function anchorManifestSummary(manifest: SettlementManifest): Promise<{ chainRef: string; rootProofHash: string }> {
  const canon = manifestCanonicalHash(manifest);
  const rootProofHash = await sha256Hex(`arc|${canon}`);
  return {
    chainRef: "hedera:testnet:placeholder",
    rootProofHash,
  };
}
