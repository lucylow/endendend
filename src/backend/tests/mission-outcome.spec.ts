import { describe, expect, it, beforeEach } from "vitest";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { bootstrapMission, proposeAndCommitPhaseTransition } from "@/backend/api/missions";
import { commitNodeJoin } from "@/backend/api/nodes";
import { missionOutcomePacketForLedger } from "@/backend/api/observability";
import { EventLogger } from "@/backend/observability/event-logger";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";

describe("mission outcome packet", () => {
  beforeEach(() => {
    EventLogger.clear();
  });

  it("materializes hashes, executive summary, and replay verification for a terminal mission", async () => {
    const missionId = "outcome-demo";
    const registry = new NodeRegistry();
    const { ledger } = await bootstrapMission(missionId, "hq", 1_800_000_000_000);

    await commitNodeJoin(ledger, registry, missionId, {
      nodeId: "uav-1",
      role: "carrier",
      joinedAtMs: 1_800_000_000_001,
      capabilities: ["carrier", "thermal"],
    }, 1_800_000_000_001);

    const phases = ["discovery", "search", "triage", "rescue", "extraction", "return", "complete"] as const;
    let tick = 2;
    for (const p of phases) {
      const r = await proposeAndCommitPhaseTransition(ledger, registry, missionId, "hq", p, 1_800_000_000_000 + tick);
      expect(r.ok).toBe(true);
      tick++;
    }

    const mission = replayMissionFromLedger(ledger.toArray(), missionId);
    expect(mission.phase).toBe("complete");

    const packet = await missionOutcomePacketForLedger(ledger, registry, missionId, 1_800_000_000_200);
    expect(packet.executiveSummary.status).toBe("success");
    expect(packet.terminalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.checkpointHash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.arcPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.settlementReady).toBe(true);
    expect(packet.replayVerified).toBe(true);
    expect(packet.chainTargets.length).toBe(2);
    expect(packet.ledgerProof.eventCount).toBeGreaterThan(3);

    const logs = EventLogger.queryByMission(missionId);
    expect(logs.some((l) => l.category === "consensus")).toBe(true);
  });
});
