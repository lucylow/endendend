import { describe, it, expect } from "vitest";
import { createBaselineSwarmNodeList, VERTEX_BASELINE_FIVE } from "@/backend/vertex/agent-profiles";
import { VENDOR_PROFILES, applyVendorToCapabilities } from "@/backend/vertex/vendor-profiles";
import { VertexSwarmSimulator } from "@/backend/vertex/swarm-simulator";
import { defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";
import { scoreBid } from "@/backend/vertex/bid-scorer";
import type { SwarmTaskSpec, TaskBid } from "@/backend/vertex/swarm-types";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { BlackoutSimulator } from "@/backend/vertex/blackout-simulator";
import { ConnectivityGraph } from "@/backend/vertex/connectivity-graph";
import { TaskOrchestrator } from "@/backend/vertex/task-orchestrator";
import { localAutonomyDirectives } from "@/backend/vertex/fallback-coordinator";

describe("Vertex 2 swarm", () => {
  it("initializes at least 5 heterogeneous agents", () => {
    const nodes = createBaselineSwarmNodeList(5, 0.9);
    expect(nodes.length).toBeGreaterThanOrEqual(5);
    const vendors = new Set(nodes.map((n) => n.vendorId));
    expect(vendors.size).toBeGreaterThanOrEqual(3);
    const roles = new Set(nodes.map((n) => n.role));
    expect(roles.size).toBeGreaterThanOrEqual(2);
  });

  it("vendor profiles change capability envelopes", () => {
    const def = VERTEX_BASELINE_FIVE[0];
    const v1 = VENDOR_PROFILES[def.vendorKey];
    const base = { ...createBaselineSwarmNodeList(1, 0.9)[0].capabilities };
    const patched = applyVendorToCapabilities(base, v1);
    expect(patched.meshRangeM).not.toEqual(base.meshRangeM);
  });

  it("bid scoring differentiates roles and sensors", () => {
    const nodes = createBaselineSwarmNodeList(5, 0.9);
    const scout = nodes.find((n) => n.nodeId === "agent-scout-a")!;
    const relay = nodes.find((n) => n.nodeId === "agent-relay-b")!;
    const task: SwarmTaskSpec = {
      taskId: "t1",
      missionId: "m1",
      taskType: "sector_search",
      priority: 5,
      location: { x: 0, y: 0, z: 0 },
      requirements: ["thermal"],
      allowedRoles: ["explorer", "relay", "carrier", "medic", "observer"],
      preferredVendorTraits: [],
      minBattery01: 0.1,
      minTrust01: 0.1,
      minConnectivity01: 0.1,
      expiresAtMs: Date.now() + 60_000,
      status: "open",
      bids: [],
      fallbackNodeIds: [],
      createdAtMs: Date.now(),
    };
    const mkBid = (nodeId: string): TaskBid => ({
      nodeId,
      etaSec: 60,
      confidence01: 0.8,
      battery01: 0.8,
      link01: 0.85,
      submittedAtMs: Date.now(),
      status: "submitted",
      scoreReasons: [],
    });
    const sScout = scoreBid(task, scout, mkBid(scout.nodeId), {
      phase: "search",
      connectivityMode: "normal",
      swarmLoad: 0.2,
      link01: 0.9,
      telemetryHealth01: 0.9,
    });
    const sRelay = scoreBid(task, relay, mkBid(relay.nodeId), {
      phase: "search",
      connectivityMode: "normal",
      swarmLoad: 0.2,
      link01: 0.9,
      telemetryHealth01: 0.9,
    });
    expect(sScout.score).toBeGreaterThan(sRelay.score);
    expect(sScout.reasons.some((r) => r.toLowerCase().includes("thermal"))).toBe(true);
  });

  it("simulator produces ledger replay and survives ticks", async () => {
    const cfg = defaultRuntimeConfig("collapsed_building", 12345);
    cfg.tickMs = 50;
    const sim = new VertexSwarmSimulator("m-vtx-test", cfg, 5);
    let view = await sim.tick();
    expect(view.nodes.length).toBe(5);
    for (let i = 0; i < 8; i++) view = await sim.tick();
    const events = sim.ledger.toArray();
    expect(events.length).toBeGreaterThan(3);
    const replayed = replayMissionFromLedger(events, "m-vtx-test");
    expect(replayed.roster).toBeDefined();
    expect(Object.keys(replayed.roster).length).toBeGreaterThanOrEqual(5);
    const chain = await sim.ledger.verifyChain();
    expect(chain.ok).toBe(true);
  });

  it("blackout simulator degrades link metrics", () => {
    const g = new ConnectivityGraph();
    g.setEdge({ a: "a", b: "b", latencyMs: 40, loss: 0.05, quality01: 0.9 });
    const b = new BlackoutSimulator();
    b.startBlackout(0, "partial", 10_000);
    b.tick(g, 100, () => 0.5);
    const e = g.getEdge("a", "b");
    expect(e!.quality01).toBeLessThan(0.9);
  });

  it("task orchestrator reassigns when winner not viable", () => {
    const orch = new TaskOrchestrator();
    orch.openTask({
      taskId: "x",
      missionId: "m",
      taskType: "generic",
      priority: 1,
      location: { x: 0, y: 0, z: 0 },
      requirements: [],
      allowedRoles: ["explorer", "relay", "carrier", "medic", "observer"],
      preferredVendorTraits: [],
      minBattery01: 0,
      minTrust01: 0,
      minConnectivity01: 0,
      expiresAtMs: Date.now() + 9999,
      status: "open",
      bids: [],
      fallbackNodeIds: [],
      createdAtMs: Date.now(),
    });
    const nodes = createBaselineSwarmNodeList(5, 0.9);
    const map = new Map(nodes.map((n) => [n.nodeId, n]));
    orch.submitBid("x", {
      nodeId: "agent-scout-a",
      etaSec: 10,
      confidence01: 0.9,
      battery01: 0.9,
      link01: 0.9,
      submittedAtMs: Date.now(),
      status: "submitted",
      scoreReasons: [],
    });
    orch.submitBid("x", {
      nodeId: "agent-relay-b",
      etaSec: 12,
      confidence01: 0.85,
      battery01: 0.85,
      link01: 0.85,
      submittedAtMs: Date.now(),
      status: "submitted",
      scoreReasons: [],
    });
    orch.scorePendingBids("x", map, {
      phase: "search",
      connectivityMode: "normal",
      swarmLoad: 0.1,
    });
    orch.assignWinner("x", Date.now());
    const next = orch.reassignFromFallback("x", map, (id) => id === "agent-relay-b", Date.now());
    expect(next).toBe("agent-relay-b");
  });

  it("local autonomy activates when operator link is gone", () => {
    const nodes = createBaselineSwarmNodeList(5, 0.9);
    const scout = nodes[0];
    const d = localAutonomyDirectives(scout, "blackout", false);
    expect(d.safeOffline).toBe(true);
    expect(d.action).toContain("local");
  });
});
