import { describe, it, expect } from "vitest";
import { mergeCellMeta, cellKey } from "@/swarm/sharedMap";
import { splitFrontiersAmongNodes } from "@/swarm/explorationManager";
import { TargetDiscoveryPipeline } from "@/swarm/targetDiscovery";
import { mergePartitionMapDeltas, materializeMergedMap } from "@/swarm/recoveryManager";
import { VertexSwarmSimulator, type VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { defaultRuntimeConfig, presetForScenario } from "@/backend/vertex/scenario-presets";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MapCellMeta } from "@/swarm/types";
import { createBaselineSwarmNodeList } from "@/backend/vertex/agent-profiles";
import { effectiveOperatorPathQuality } from "@/swarm/networkModel";
import { P2PMessageBus } from "@/swarm/messageBus";
import { normalizeSwarmView } from "@/swarm/stateNormalizer";

describe("swarm coordination layer", () => {
  it("monotonic map merge never regresses cell rank", () => {
    const a: MapCellMeta = { state: "searched", version: 2, updatedAtMs: 100, lastNodeId: "a" };
    const b: MapCellMeta = { state: "seen", version: 99, updatedAtMs: 200, lastNodeId: "b" };
    const m = mergeCellMeta(a, b);
    expect(m.state).toBe("searched");
  });

  it("mergePartitionMapDeltas joins divergent node maps", () => {
    const d1 = {
      cells: { [cellKey(0, 0)]: { state: "searched" as const, version: 1, updatedAtMs: 1, lastNodeId: "n1" } },
      originNodeId: "n1",
      emittedAtMs: 1,
    };
    const d2 = {
      cells: { [cellKey(1, 0)]: { state: "frontier" as const, version: 2, updatedAtMs: 2, lastNodeId: "n2" } },
      originNodeId: "n2",
      emittedAtMs: 2,
    };
    const merged = mergePartitionMapDeltas([d1, d2]);
    expect(Object.keys(merged).length).toBe(2);
    const map = materializeMergedMap(merged);
    expect(map.getCell(cellKey(0, 0))?.state).toBe("searched");
  });

  it("splitFrontiersAmongNodes distributes keys across explorers", () => {
    const keys = ["0,0", "1,0", "2,0", "3,0"];
    const m = splitFrontiersAmongNodes(keys, ["a", "b"]);
    expect((m.get("a")?.length ?? 0) + (m.get("b")?.length ?? 0)).toBe(keys.length);
  });

  it("target discovery promotes on corroboration", () => {
    const pipe = new TargetDiscoveryPipeline();
    const nodes = createBaselineSwarmNodeList(2, 0.9);
    const nodeA = nodes[0];
    const nodeB = nodes[1];
    nodeA.position = { x: 4, y: 0, z: 0 };
    nodeB.position = { x: 4.5, y: 0, z: 0 };
    const r1 = pipe.addEvidence({
      missionId: "m",
      node: nodeA,
      sensor: "thermal",
      confidence01: 0.55,
      nowMs: 1,
      scenario: "collapsed_building",
    });
    expect(r1.promoted).toBe(false);
    const r2 = pipe.addEvidence({
      missionId: "m",
      node: nodeB,
      sensor: "peer_confirm",
      confidence01: 0.6,
      nowMs: 2,
      scenario: "collapsed_building",
    });
    expect(r2.promoted).toBe(true);
  });

  it("simulator grows map coverage over ticks (seeded)", async () => {
    const cfg = defaultRuntimeConfig("tunnel", 999);
    cfg.tickMs = 30;
    const sim = new VertexSwarmSimulator("m-swarm-grow", cfg, 5);
    let v = await sim.tick();
    const c0 = v.sharedMap.coverage01;
    const cells0 = Object.keys(v.sharedMap.cells).length;
    for (let i = 0; i < 20; i++) v = await sim.tick();
    expect(Object.keys(v.sharedMap.cells).length).toBeGreaterThanOrEqual(cells0);
    expect(v.sharedMap.coverage01).toBeGreaterThanOrEqual(c0);
  });

  it("effectiveOperatorPathQuality prefers relay hop when direct is weak", () => {
    const op = "op";
    const edges = [
      { a: "n1", b: op, latencyMs: 40, loss: 0.1, quality01: 0.08 },
      { a: "n1", b: "relay", latencyMs: 30, loss: 0.05, quality01: 0.72 },
      { a: "relay", b: op, latencyMs: 35, loss: 0.05, quality01: 0.68 },
    ];
    const reach = new Set(["op", "relay", "n1"]);
    const r = effectiveOperatorPathQuality(edges, reach, "n1", op);
    expect(r.quality01).toBeGreaterThan(0.2);
    expect(r.usesRelay).toBe(true);
  });

  it("P2P message bus retries after loss (deterministic seed)", () => {
    const bus = new P2PMessageBus(12345);
    bus.enqueue({
      from: "a",
      to: "b",
      topic: "heartbeat",
      payload: { ok: true },
      createdAtMs: 0,
      deliverAfterMs: 0,
    });
    let delivered = 0;
    for (let t = 0; t < 1200; t++) {
      const { delivered: d } = bus.tick(t, { lossBias01: 0.02, duplicateChance01: 0 });
      delivered += d.length;
      if (delivered) break;
    }
    expect(delivered).toBeGreaterThanOrEqual(1);
  });

  it("normalizeSwarmView fills safe defaults on empty graph", () => {
    const v = {
      nowMs: 1,
      missionId: "m",
      operatorNodeId: "op",
      phase: "discovery" as const,
      scenario: "tunnel" as const,
      preset: presetForScenario("tunnel"),
      nodes: createBaselineSwarmNodeList(5, 0.9),
      telemetry: [],
      connectivityMode: "normal" as const,
      graph: {
        edges: [],
        partitionClusters: [],
        operatorReachable: new Set<string>(),
        relayChains: [],
        stalePeers: new Set<string>(),
      },
      tasks: [],
      autonomy: [],
      ledgerTail: [],
      missionReplay: replayMissionFromLedger([], "m"),
      blackoutActive: false,
      seed: 1,
      tickCount: 1,
      sharedMap: { cells: {}, coverage01: 0, explored: 0, frontier: 0, targetCells: 0 },
      exploration: [],
      discovery: [],
      roleHandoffs: [],
    };
    const n = normalizeSwarmView(v as unknown as VertexSwarmView);
    expect(n?.peers.length).toBe(5);
    expect(n?.partition.clusterCount).toBe(0);
  });

  it("replay remains consistent after target + checkpoint extras", async () => {
    const cfg = defaultRuntimeConfig("hazmat", 42);
    cfg.tickMs = 20;
    const sim = new VertexSwarmSimulator("m-replay", cfg, 5);
    await sim.injectTargetNear("agent-scout-a");
    for (let i = 0; i < 25; i++) await sim.tick();
    const events = sim.ledger.toArray();
    const chain = await sim.ledger.verifyChain();
    expect(chain.ok).toBe(true);
    const st = replayMissionFromLedger(events, "m-replay");
    expect(Object.keys(st.targets).length).toBeGreaterThanOrEqual(1);
  });
});
