import { describe, expect, it } from "vitest";
import {
  CapabilityTag,
  HealthStatus,
  LatticeAssignmentPlanner,
  LatticeRewardSystem,
  NodeRegistry,
  NodeRole,
  RewardKind,
  ScenarioKind,
  TriangulatedValidator,
  ValidationType,
  buildDemoNodeProfile,
  buildDemoWorkItem,
  hashObject,
  latticeSmokeDemo,
} from "@/backend/lattice/lattice-reward-stack";

describe("lattice-reward-stack", () => {
  it("runs smoke demo without throwing", () => {
    const out = latticeSmokeDemo();
    expect(out.balances).toBeDefined();
    expect(out.health).toMatchObject({ nodeCount: expect.any(Number) });
  });

  it("settles contribution by direct map lookup", () => {
    const registry = new NodeRegistry();
    const lattice = new LatticeRewardSystem(registry);
    const node = buildDemoNodeProfile("n1", NodeRole.Explorer, [CapabilityTag.Camera], { missionId: "m1" });
    lattice.registerNode(node);
    lattice.updateHealth(node.nodeId, { missionId: "m1" });
    const eventId = "fixed-contrib-1";
    lattice.recordContribution({
      eventId,
      missionId: "m1",
      nodeId: node.nodeId,
      kind: RewardKind.Work,
      label: "test",
      weight: 1,
      createdAtMs: Date.now(),
      metadata: {},
    });
    const ledger = lattice.settleContribution(eventId, null);
    expect(ledger).not.toBeNull();
    expect(ledger?.balanceAfter).toBeGreaterThan(0);
  });

  it("rejects ineligible nodes by health status", () => {
    const registry = new NodeRegistry();
    const planner = new LatticeAssignmentPlanner(registry);
    const node = buildDemoNodeProfile("n2", NodeRole.Explorer, [CapabilityTag.Indoor, CapabilityTag.Camera, CapabilityTag.IMU], {
      status: HealthStatus.Unhealthy,
      batteryPct: 90,
      linkQuality: 0.9,
    });
    registry.register(node);
    const work = buildDemoWorkItem("m2", ScenarioKind.Indoor, "t1", "search", [CapabilityTag.Indoor, CapabilityTag.Camera, CapabilityTag.IMU]);
    expect(planner.eligible(node, work)).toBe(false);
    expect(planner.rank(work)).toHaveLength(0);
  });

  it("has stable manifest hash for same inputs", () => {
    const a = hashObject({ x: 1, b: 2 });
    const b = hashObject({ b: 2, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("triangulated validator requires witness quorum", () => {
    const v = new TriangulatedValidator();
    const proof = v.createProof({
      validationType: ValidationType.TaskCompletion,
      missionId: "m",
      subjectNodeId: "subj",
      witnesses: ["w1", "w2", "w3"],
      evidence: {},
    });
    v.addAttestation({
      witnessId: "w1",
      subjectNodeId: "subj",
      validationType: ValidationType.TaskCompletion,
      accepted: true,
      reason: "ok",
      timestampMs: Date.now(),
      evidenceHash: "h1",
    });
    v.addAttestation({
      witnessId: "w2",
      subjectNodeId: "subj",
      validationType: ValidationType.TaskCompletion,
      accepted: true,
      reason: "ok",
      timestampMs: Date.now(),
      evidenceHash: "h2",
    });
    const evaluated = v.evaluate(proof.proofId);
    expect(evaluated?.accepted).toBe(true);
  });
});
