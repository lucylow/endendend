import { describe, expect, it } from "vitest";

import { NodeRole } from "@/backend/shared/tashi-mission-map-machine";
import {
  EventLedgerStore,
  TaskBidRegistry,
  RecoveryCheckpointManager,
  InMemoryCheckpointStore,
  ScenarioKind,
  TaskBidStatus,
  taskBiddingRecoverySmokeDemo,
} from "@/backend/shared/tashi-task-bidding-recovery";

describe("EventLedgerStore.missionEventsAfter", () => {
  it("replays only tail events after a sealed hash", () => {
    const ledger = new EventLedgerStore();
    const a = ledger.append({ missionId: "m1", kind: "a", actorId: "n1", payload: {} });
    ledger.append({ missionId: "m1", kind: "b", actorId: "n1", payload: {} });
    const tail = ledger.missionEventsAfter("m1", a.cumulativeHash);
    expect(tail).toHaveLength(1);
    expect(tail[0].kind).toBe("b");
  });
});

describe("TaskBidRegistry", () => {
  it("buildCommit returns a record with proof hash", () => {
    const r = new TaskBidRegistry();
    const task = {
      taskId: "t1",
      missionId: "m1",
      scenario: ScenarioKind.Forest,
      taskType: "search",
      priority: 1,
      requiredCapabilities: [],
      minTrustScore: 0,
      minBatteryPct: 0,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 1000,
      metadata: {},
    };
    r.openWindow(task, 1, 1, 5000);
    const bid = {
      bidId: "b1",
      taskId: "t1",
      missionId: "m1",
      nodeId: "n1",
      role: NodeRole.Explorer,
      scenario: ScenarioKind.Forest,
      capabilityScore: 0,
      trustScore: 0.5,
      reputationScore: 0.5,
      batteryPct: 80,
      linkQuality: 0.9,
      etaMs: 1000,
      confidence: 0.8,
      distanceM: 10,
      resources: {},
      proofHints: {},
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 4000,
      status: TaskBidStatus.Submitted,
      metadata: {},
    };
    const c = r.buildCommit(task, bid, 1, "n1", "test");
    expect(c.taskId).toBe("t1");
    expect(c.proofHash).toHaveLength(64);
  });
});

describe("RecoveryCheckpointManager", () => {
  it("verifies integrity and sealed head match", () => {
    const store = new InMemoryCheckpointStore();
    const mgr = new RecoveryCheckpointManager(store);
    const cp = mgr.createCheckpoint({
      missionId: "m",
      phase: "search",
      phaseVersion: 1,
      consensusSequence: 0,
      map: {
        mapId: "map",
        version: 3,
        updatedAtMs: Date.now(),
        cells: {},
        frontierCount: 0,
        searchedCount: 0,
        blockedCount: 0,
        targetCount: 0,
        exploredCount: 0,
        dirtyCount: 0,
        coveragePct: 0,
        metadata: {},
      },
      nodes: [],
      targets: [],
      lastLedgerHash: "abc",
      createdBy: "n1",
      reason: "test",
    });
    const v = mgr.verify(cp, "abc", 3);
    expect(v.ok).toBe(true);
    expect(v.integrityOk).toBe(true);
    const broken = { ...cp, proofHash: "deadbeef" };
    expect(mgr.verifyIntegrity(broken)).toBe(false);
  });
});

describe("taskBiddingRecoverySmokeDemo", () => {
  it("runs end-to-end", async () => {
    const out = await taskBiddingRecoverySmokeDemo();
    expect(out.ledgerVerify).toEqual({ ok: true, reason: "ok" });
    expect(out.verification).toMatchObject({ ok: true, integrityOk: true });
    expect((out.commit as { phase?: string }).phase).toBe("committed");
  });
});
