import { describe, expect, it } from "vitest";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { bootstrapMission, missionEnvelopeView, proposeAndCommitPhaseTransition } from "@/backend/api/missions";
import { commitNodeJoin } from "@/backend/api/nodes";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { sarProjectionFromEnvelope } from "@/backend/api/snapshot-bridge";
import { sealArcSettlement } from "@/backend/api/settlement";

describe("SAR Tashi flow", () => {
  it("replays ledger through phases and Arc settlement", async () => {
    const missionId = "sar-demo-1";
    const registry = new NodeRegistry();
    const { ledger } = await bootstrapMission(missionId, "hq", 1_700_000_000_000);

    await commitNodeJoin(ledger, registry, missionId, {
      nodeId: "uav-1",
      role: "carrier",
      joinedAtMs: 1_700_000_000_001,
      capabilities: ["carrier", "thermal"],
    }, 1_700_000_000_001);

    const chain: Array<"discovery" | "search" | "triage" | "rescue" | "extraction" | "return" | "complete"> = [
      "discovery",
      "search",
      "triage",
      "rescue",
      "extraction",
      "return",
      "complete",
    ];
    let tick = 2;
    for (const p of chain) {
      const r = await proposeAndCommitPhaseTransition(ledger, registry, missionId, "hq", p, 1_700_000_000_000 + tick);
      expect(r.ok).toBe(true);
      tick++;
    }

    const mission = replayMissionFromLedger(ledger.toArray(), missionId);
    expect(mission.phase).toBe("complete");
    expect(mission.roster["uav-1"]?.role).toBe("carrier");

    const env = missionEnvelopeView(ledger, registry, missionId, 1_700_000_000_100);
    expect(env.policy).toBeUndefined();
    const sar = sarProjectionFromEnvelope(env);
    expect(sar.missionPhase).toBe("complete");
    expect(sar.vertexSequence).toBeGreaterThan(0);

    const settled = await sealArcSettlement(ledger, registry, missionId, 1_700_000_000_200);
    if ("error" in settled) throw new Error(settled.error);
    expect(settled.manifest.missionId).toBe(missionId);
    expect(settled.rewardManifest.missionId).toBe(missionId);
    expect(settled.rewardManifest.arcSettlement.chain).toBe("hedera");
    expect(settled.manifest.evidenceBundleHash).toMatch(/^[a-f0-9]{64}$/);
    expect(settled.manifest.arcPayload.proofMerkleRoot).toMatch(/^[a-f0-9]{64}$/);
    expect(settled.envelopePatch.arc?.evidenceBundleHash).toBe(settled.manifest.evidenceBundleHash);
    expect(settled.anchor.rootProofHash.length).toBe(64);
    expect(settled.mockBridgeTxHash).toMatch(/^[a-f0-9]{64}$/);
    expect(settled.envelopePatch.arc?.mockBridgeTxHash).toBe(settled.mockBridgeTxHash);
    expect(settled.envelopePatch.settlement?.manifestId).toBe(settled.manifest.manifestId);
    expect(await ledger.verifyChain()).toEqual({ ok: true });
  });
});
