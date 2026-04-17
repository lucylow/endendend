import { describe, expect, it } from "vitest";
import { MissionLedger } from "@/backend/vertex/mission-ledger";

describe("MissionLedger", () => {
  it("chains hashes and verifies", async () => {
    const ledger = new MissionLedger();
    const t = 1_700_000_000_000;
    await ledger.append({
      missionId: "m1",
      actorId: "a1",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "init" },
      timestamp: t,
      previousHash: "genesis",
    });
    await ledger.append({
      missionId: "m1",
      actorId: "a1",
      eventType: "node_join",
      plane: "vertex",
      payload: { nodeId: "n1", role: "explorer", capabilities: [] },
      timestamp: t + 1,
      previousHash: ledger.tailHash(),
    });
    const v = await ledger.verifyChain();
    expect(v.ok).toBe(true);
    expect(ledger.length).toBe(2);
  });
});
