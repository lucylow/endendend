import { describe, it, expect } from "vitest";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import { createBaselineSwarmNodeList } from "@/backend/vertex/agent-profiles";
import { MeshSurvivalEngine } from "./meshSurvivalEngine";
import { advanceDiscoveryRegistry, discoveryEntries } from "./discoveryEngine";
import { planRelays } from "./relayPlanner";
import { computeRoutePlans } from "./routeOptimizer";
import { buildOperationalGraph } from "./connectivityGraph";
import { buildRichProfile, clusterIdForNode } from "./nodeProfiles";
import { MeshMessageBus } from "./messageBus";
import { mulberry32 } from "@/swarm/seededRng";
import type { MeshResiliencePublicView } from "@/vertex2/types";

function chainSnap(ids: string[], op: string): ConnectivitySnapshot {
  const edges = [];
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push({
      a: ids[i]!,
      b: ids[i + 1]!,
      latencyMs: 30 + i * 6,
      loss: 0.06 + i * 0.01,
      quality01: 0.82 - i * 0.02,
    });
  }
  return {
    edges,
    partitionClusters: [ids],
    operatorReachable: new Set(ids),
    relayChains: [],
    stalePeers: new Set(),
  };
}

function minimalV2(over: Partial<MeshResiliencePublicView> = {}): MeshResiliencePublicView {
  const base: MeshResiliencePublicView = {
    missionId: "m",
    nowMs: 1000,
    seed: 1,
    stressMode: "lossy",
    connectivityMode: "normal",
    peers: [],
    graph: { nodes: [], links: [], bridges: [], relayRank: [], operatorReachable: [], isolated: [], partitionLabels: {} },
    discoveryPulse: 0,
    consensus: {
      health: { sequence: 0, pending: 0, committed: 0, rejected: 0, stress01: 0.55 },
      proposals: [],
    },
    ledgerTail: [],
    replay: [],
    taskHistory: [],
    roleHistory: [],
    checkpoints: [],
    stats: { deliveredVotes: 0, droppedVotes: 0, delayedDeliveries: 0, duplicates: 0, bufferedWhileOffline: 0, reroutes: 0 },
    liveMode: "mock",
  };
  return { ...base, ...over };
}

describe("mesh survival", () => {
  it("advances discovery under stress with deterministic RNG", () => {
    const rng = mulberry32(99);
    const cells = new Map();
    const ids = ["a", "b", "c", "d"];
    const snap = chainSnap(ids, "a");
    advanceDiscoveryRegistry({
      snap,
      observerIds: ids,
      stress: "lossy",
      loss01: 0.4,
      rng,
      cells,
    });
    advanceDiscoveryRegistry({
      snap,
      observerIds: ids,
      stress: "lossy",
      loss01: 0.4,
      rng: mulberry32(99),
      cells,
    });
    const entries = discoveryEntries(cells);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("relay planner prefers high-suitability nodes on a bridge-like graph", () => {
    const nodes = createBaselineSwarmNodeList(6, 0.9);
    const ids = nodes.map((n) => n.nodeId);
    const snap: ConnectivitySnapshot = {
      edges: [
        { a: ids[0]!, b: ids[1]!, latencyMs: 40, loss: 0.05, quality01: 0.9 },
        { a: ids[1]!, b: ids[2]!, latencyMs: 40, loss: 0.05, quality01: 0.88 },
        { a: ids[2]!, b: ids[3]!, latencyMs: 40, loss: 0.05, quality01: 0.86 },
      ],
      partitionClusters: [ids],
      operatorReachable: new Set(ids),
      relayChains: [],
      stalePeers: new Set(),
    };
    const profiles = nodes.map((n, i) => buildRichProfile(n, i, 1000, clusterIdForNode(n.nodeId, snap.partitionClusters)));
    const g = buildOperationalGraph(snap, profiles);
    const plan = planRelays({ operatorId: ids[0]!, snap, profiles, graph: g, rng: () => 0.3 });
    expect(plan[0]).toBeTruthy();
    expect(plan[0]!.score01).toBeGreaterThan(0.2);
  });

  it("route optimizer returns primary and backup paths", () => {
    const ids = ["o", "r", "t"];
    const snap = chainSnap(ids, "o");
    const routes = computeRoutePlans({ snap, operatorId: "o", targets: ["t"] });
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]!.primaryPath[0]).toBe("o");
    expect(routes[0]!.primaryPath.at(-1)).toBe("t");
  });

  it("message bus buffers when unreachable then drains", () => {
    const bus = new MeshMessageBus();
    bus.emitDirect({
      from: "o",
      to: "z",
      missionId: "m",
      nowMs: 100,
      seq: 1,
      topic: "ping",
      body: {},
      loss01: 0,
      reachable: () => false,
      rng: () => 0.1,
    });
    expect(bus.stats().buffered).toBeGreaterThan(0);
    for (let t = 100; t < 900; t += 50) {
      bus.tick({ nowMs: t, missionId: "m", loss01: 0.01, reachable: () => true, rng: () => 0.01 });
    }
    expect(bus.stats().delivered).toBeGreaterThan(0);
  });

  it("mesh survival engine step is deterministic for same seed and tick", () => {
    const nodes = createBaselineSwarmNodeList(5, 0.9);
    const ids = nodes.map((n) => n.nodeId);
    const snap = chainSnap(ids, ids[0]!);
    const eng = new MeshSurvivalEngine(42);
    const ctx = (tick: number) => ({
      missionId: "m",
      nowMs: 10_000 + tick * 400,
      tickIndex: tick,
      seed: 42,
      connectivityMode: "normal" as const,
      graph: snap,
      nodes,
      operatorNodeId: ids[0]!,
      liveMode: "mock" as const,
      meshV2: minimalV2({ stressMode: "normal", consensus: { health: { sequence: 1, pending: 0, committed: 0, rejected: 0, stress01: 0.08 }, proposals: [] } }),
      telemetry: [],
    });
    const a = eng.step(ctx(3));
    eng.reset(42);
    const b = eng.step(ctx(3));
    expect(a.stressPresetId).toBe(b.stressPresetId);
    expect(a.discovery.entries.length).toBe(b.discovery.entries.length);
  });

  it("partition heal flushes recovery buffer", () => {
    const eng = new MeshSurvivalEngine(7);
    const nodes = createBaselineSwarmNodeList(5, 0.9);
    const ids = nodes.map((n) => n.nodeId);
    const split: ConnectivitySnapshot = {
      edges: [{ a: ids[0]!, b: ids[1]!, latencyMs: 40, loss: 0.05, quality01: 0.8 }],
      partitionClusters: [[ids[0]!, ids[1]!], [ids[2]!, ids[3]!, ids[4]!]],
      operatorReachable: new Set([ids[0]!, ids[1]!]),
      relayChains: [],
      stalePeers: new Set(),
    };
    const merged: ConnectivitySnapshot = {
      ...split,
      partitionClusters: [ids],
      operatorReachable: new Set(ids),
    };
    const v2 = minimalV2();
    eng.step({
      missionId: "m",
      nowMs: 1,
      tickIndex: 1,
      seed: 7,
      connectivityMode: "partial_partition",
      graph: split,
      nodes,
      operatorNodeId: ids[0]!,
      liveMode: "mock",
      meshV2: v2,
    });
    const after = eng.step({
      missionId: "m",
      nowMs: 2,
      tickIndex: 2,
      seed: 7,
      connectivityMode: "normal",
      graph: merged,
      nodes,
      operatorNodeId: ids[0]!,
      liveMode: "mock",
      meshV2: v2,
    });
    expect(["flushing", "merged", "steady"]).toContain(after.recovery.phase);
  });
});
