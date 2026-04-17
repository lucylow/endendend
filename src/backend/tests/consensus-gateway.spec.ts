import { describe, expect, it } from "vitest";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { commitVertexBatch, suggestPhaseTransition, suggestTargetDiscovery } from "@/backend/vertex/consensus-gateway";

describe("commitVertexBatch", () => {
  it("orders deterministically by tie-break keys", async () => {
    const ledger = new MissionLedger();
    const t = 1_700_000_000_000;
    await ledger.append({
      missionId: "m1",
      actorId: "coord",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "init" },
      timestamp: t,
      previousHash: "genesis",
    });
    const s1 = suggestTargetDiscovery("m1", "drone-b", "tgt-1", t + 2);
    const s2 = suggestTargetDiscovery("m1", "drone-a", "tgt-2", t + 2);
    await commitVertexBatch(ledger, [s1, s2]);
    const tail = ledger.toArray().slice(-2).map((e) => e.payload.targetId);
    expect(tail).toEqual(["tgt-2", "tgt-1"]);
  });

  it("rejects illegal phase suggestion", () => {
    const r = suggestPhaseTransition("m1", "a", "complete", "discovery", Date.now());
    expect("error" in r).toBe(true);
  });
});
