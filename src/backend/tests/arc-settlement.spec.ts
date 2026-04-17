import { describe, expect, it } from "vitest";
import { buildEvidenceBundle } from "@/backend/arc/evidence-bundle";
import { buildSettlementManifest } from "@/backend/arc/settlement-manifest";
import { anchorManifestSummary } from "@/backend/arc/proof-anchor";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { buildRewardManifest } from "@/backend/arc/reward-manifest";
import { sealArcSettlement } from "@/backend/api/settlement";

describe("Arc settlement + evidence pipeline", () => {
  it("classifies Vertex SAR events into evidence items with Lattice scores", async () => {
    const missionId = "m-evidence";
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();

    await ledger.append({
      missionId,
      actorId: "drone-a",
      eventType: "target_discovered",
      plane: "vertex",
      payload: { targetId: "t1", thermalTemp: 38.2 },
      timestamp: 1,
      previousHash: ledger.tailHash(),
    });
    await ledger.append({
      missionId,
      actorId: "drone-a",
      eventType: "extraction_confirmed",
      plane: "vertex",
      payload: { targetId: "t1" },
      timestamp: 2,
      previousHash: ledger.tailHash(),
    });

    registry.seedRoster({
      "drone-a": {
        nodeId: "drone-a",
        role: "explorer",
        joinedAtMs: 0,
        capabilities: ["thermal", "rgb"],
      },
    });

    const bundle = await buildEvidenceBundle(missionId, ledger.toArray(), registry);
    expect(bundle.items.length).toBe(2);
    expect(bundle.items[0].evidenceType).toBe("thermal_hit");
    expect(bundle.bundleHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.merkleRoot).toMatch(/^[a-f0-9]{64}$/);
  });

  it("buildRewardManifest rejects non-terminal missions", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    await ledger.append({
      missionId: "x",
      actorId: "hq",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "search", name: "x" },
      timestamp: 1,
      previousHash: ledger.tailHash(),
    });
    await expect(buildRewardManifest(ledger, registry, "x", 9)).rejects.toThrow(/terminal/);
  });

  it("sealArcSettlement rejects non-terminal missions", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    await ledger.append({
      missionId: "x",
      actorId: "hq",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "search", name: "x" },
      timestamp: 1,
      previousHash: ledger.tailHash(),
    });
    const r = await sealArcSettlement(ledger, registry, "x", 9);
    expect("error" in r && r.error).toBe("mission_not_terminal");
  });

  it("buildSettlementManifest joins certificate, rewards, and Arc payload", async () => {
    const missionId = "m1";
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();

    await ledger.append({
      missionId,
      actorId: "hq",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "complete", name: missionId, cellsKnown: 25 },
      timestamp: 1,
      previousHash: ledger.tailHash(),
    });
    await ledger.append({
      missionId,
      actorId: "n1",
      eventType: "node_join",
      plane: "vertex",
      payload: { nodeId: "n1", role: "explorer", capabilities: ["thermal"] },
      timestamp: 2,
      previousHash: ledger.tailHash(),
    });
    await ledger.append({
      missionId,
      actorId: "n1",
      eventType: "target_discovered",
      plane: "vertex",
      payload: { targetId: "v1" },
      timestamp: 3,
      previousHash: ledger.tailHash(),
    });
    await ledger.append({
      missionId,
      actorId: "n1",
      eventType: "safety_alert",
      plane: "vertex",
      payload: { alertId: "a1", level: "warn", message: "gas" },
      timestamp: 4,
      previousHash: ledger.tailHash(),
    });

    registry.seedRoster({
      n1: { nodeId: "n1", role: "explorer", joinedAtMs: 2, capabilities: ["thermal", "gas"] },
    });

    const mission = replayMissionFromLedger(ledger.toArray(), missionId);
    const head = ledger.head()!.eventHash;
    const manifest = await buildSettlementManifest(mission, ledger.toArray(), registry, {
      manifestId: "mid",
      sealedAtMs: 99,
      ledgerRootHash: head,
      outcome: "success",
    });

    expect(manifest.nodeContributions.length).toBe(1);
    expect(manifest.nodeContributions[0].contributions.length).toBe(2);
    expect(manifest.missionCertificate.safetyEvents).toBeGreaterThanOrEqual(0);
    expect(manifest.arcPayload.chain).toBe("hedera");
    const anchor = await anchorManifestSummary(manifest);
    expect(anchor.chainRef.startsWith("hedera:")).toBe(true);

    const reward = await buildRewardManifest(ledger, registry, missionId, 100, "collapsed_building");
    expect(reward.verification.vertexLedgerTail).toMatch(/^[a-f0-9]{64}$/);
    expect(reward.verification.merkleProofRoot).toMatch(/^[a-f0-9]{64}$/);
    expect(reward.totalPool).toContain("HBAR");
  });
});
