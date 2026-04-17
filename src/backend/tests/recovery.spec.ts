import { describe, expect, it } from "vitest";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { RecoveryManager } from "@/backend/recovery/recovery-manager";
import { AllocationEngine, buildAllocationProfiles, POLICY_WEIGHTS } from "@/backend/lattice/allocation-policies";
import { emptyMissionState } from "@/backend/shared/mission-state";
import { buildTashiStateEnvelope } from "@/backend/shared/build-envelope";

describe("RecoveryManager", () => {
  it("reports degraded recovery state when map lag exceeds threshold", () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const recovery = new RecoveryManager(ledger, registry);
    const t = 1_900_000_000_000;
    const mission = emptyMissionState("test-mission", t);
    mission.mapSummary = { cellsKnown: 500 };
    mission.roster["test-node"] = {
      nodeId: "test-node",
      role: "explorer",
      joinedAtMs: t,
      capabilities: ["thermal"],
    };
    registry.seedRoster(mission.roster);
    registry.heartbeat("test-node", { batteryReserve: 0.8, linkQuality: 0.9, sensors: ["thermal"] }, t);

    const report = recovery.recoverNode("test-node", "test-mission", mission, t, {
      localMapCells: 470,
    });
    expect(report.currentState).toBe("degraded");
    expect(report.diagnostics.mapLagPercent).toBeGreaterThan(0);
    expect(report.headline).toContain("degraded");
    expect(report.operatorActions).toContain("monitor");
  });

  it("marks stale when checkpoint lag is beyond operator threshold", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const recovery = new RecoveryManager(ledger, registry);
    const t = 1_900_000_000_100;
    const missionId = "m-stale";
    for (let i = 0; i < 110; i++) {
      await ledger.append({
        missionId,
        actorId: "hq",
        eventType: "recovery_checkpoint",
        plane: "vertex",
        payload: { nodeId: "n-stale", label: `cp-${i}` },
        timestamp: t + i,
        previousHash: ledger.tailHash(),
      });
    }
    const mission = emptyMissionState(missionId, t);
    mission.roster["n-stale"] = {
      nodeId: "n-stale",
      role: "relay",
      joinedAtMs: t,
      capabilities: ["relay"],
    };
    mission.roster["n-peer"] = {
      nodeId: "n-peer",
      role: "explorer",
      joinedAtMs: t,
      capabilities: [],
    };
    registry.seedRoster(mission.roster);
    registry.heartbeat("n-stale", { batteryReserve: 0.7, linkQuality: 0.8, sensors: [] }, t);
    registry.heartbeat("n-peer", { batteryReserve: 0.7, linkQuality: 0.8, sensors: [] }, t);
    recovery.seedLocalCheckpoint(missionId, "n-stale", "genesis");

    const report = recovery.recoverNode("n-stale", missionId, mission, t + 200);
    expect(report.currentState).toBe("stale");
    expect(report.diagnostics.initialCheckpointLag).toBeGreaterThan(100);
    expect(report.operatorActions).toContain("manual_sync");
  });

  it("replays ledger slice and clears residual lag", async () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const recovery = new RecoveryManager(ledger, registry);
    const t = 1_900_000_000_200;
    const missionId = "m-replay";
    const mission = emptyMissionState(missionId, t);
    mission.roster["n1"] = { nodeId: "n1", role: "explorer", joinedAtMs: t, capabilities: ["thermal"] };
    mission.roster["n2"] = { nodeId: "n2", role: "relay", joinedAtMs: t, capabilities: ["relay"] };
    registry.seedRoster(mission.roster);
    registry.heartbeat("n1", { batteryReserve: 0.8, linkQuality: 0.85, sensors: ["thermal"] }, t);
    registry.heartbeat("n2", { batteryReserve: 0.8, linkQuality: 0.85, sensors: [] }, t);

    for (let i = 0; i < 35; i++) {
      await ledger.append({
        missionId,
        actorId: "hq",
        eventType: "recovery_checkpoint",
        plane: "vertex",
        payload: { nodeId: "n1", label: `cp-${i}` },
        timestamp: t + i,
        previousHash: ledger.tailHash(),
      });
    }
    const events = ledger.eventsForMission(missionId);
    const oldHash = events[5]?.eventHash;
    expect(oldHash).toBeTruthy();
    recovery.seedLocalCheckpoint(missionId, "n1", oldHash!);

    const report = recovery.recoverNode("n1", missionId, mission, t + 500, {
      localMapCells: mission.mapSummary.cellsKnown,
    });
    expect(report.diagnostics.replayedEvents).toBeGreaterThan(20);
    expect(report.diagnostics.checkpointLag).toBe(0);
    expect(report.currentState).toBe("recovered");
  });
});

describe("AllocationEngine", () => {
  it("weights wildfire toward thermal / hazard clearance", () => {
    const w = POLICY_WEIGHTS.wildfire;
    expect(w.thermalMatch).toBeGreaterThan(w.relayContinuity);
    expect(w.hazardClearance).toBeGreaterThan(w.proximity);
  });

  it("weights collapsed building toward relay continuity", () => {
    const w = POLICY_WEIGHTS.collapsed_building;
    expect(w.relayContinuity).toBeGreaterThan(w.thermalMatch);
  });

  it("ranks deterministically and produces explainable copy", () => {
    const t = 1_900_000_000_300;
    const mission = emptyMissionState("m-alc", t);
    mission.roster["relay-a"] = {
      nodeId: "relay-a",
      role: "relay",
      joinedAtMs: t,
      capabilities: ["relay", "long_range_radio"],
    };
    mission.roster["exp-b"] = {
      nodeId: "exp-b",
      role: "explorer",
      joinedAtMs: t,
      capabilities: ["thermal"],
    };
    const registry = new NodeRegistry();
    registry.seedRoster(mission.roster);
    registry.heartbeat("relay-a", { batteryReserve: 0.9, linkQuality: 0.95, sensors: [] }, t);
    registry.heartbeat("exp-b", { batteryReserve: 0.85, linkQuality: 0.5, sensors: ["thermal"] }, t);

    const profiles = buildAllocationProfiles(mission, registry, t, 30_000);
    const engine = new AllocationEngine();
    const ranked = engine.scoreForTask(profiles, "relay", "collapsed_building", mission, {
      lat: 37.78,
      lng: -122.4,
    });
    expect(ranked[0].nodeId).toBe("relay-a");
    const expl = engine.explainAssignment(ranked[0], "collapsed_building");
    expect(expl).toContain("relay-a");
    expect(expl).toContain("collapsed_building");
  });
});

describe("Envelope recovery + allocation", () => {
  it("embeds recovery reports and allocation preview", () => {
    const ledger = new MissionLedger();
    const registry = new NodeRegistry();
    const t = 1_900_000_000_400;
    const mission = emptyMissionState("m-env", t);
    mission.scenario = "wildfire";
    mission.mapSummary.cellsKnown = 200;
    mission.roster["a1"] = { nodeId: "a1", role: "explorer", joinedAtMs: t, capabilities: ["thermal"] };
    registry.seedRoster(mission.roster);
    registry.heartbeat("a1", { batteryReserve: 0.88, linkQuality: 0.9, sensors: ["thermal"] }, t);

    const env = buildTashiStateEnvelope(mission, ledger, registry, t, {
      includeRecoveryForRoster: true,
      recoveryLocalMapCellsByNode: { a1: 190 },
      allocationTaskType: "explorer",
      allocationTargetCoords: { lat: 37.77, lng: -122.41 },
    });
    expect(env.recovery?.reports).toHaveLength(1);
    expect(env.recovery?.aggregateHeadline).toBeTruthy();
    expect(env.allocationPreview?.ranked.length).toBeGreaterThan(0);
    expect(env.allocationPreview?.topExplanation).toContain("a1");
  });
});
