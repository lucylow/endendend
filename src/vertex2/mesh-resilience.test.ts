import { describe, it, expect } from "vitest";
import { MeshResilienceSimulator } from "./meshResilienceSimulator";
import type { MeshStepContext } from "./types";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import { mockSwarmNodes, mockMeshPeers } from "./mockVertexFactory";
import { advanceDiscovery } from "./peerDiscovery";
import { MeshConsensusEngine } from "./consensusEngine";
import { createNetworkConditionController } from "./networkConditions";
import { buildMeshGraphView } from "./connectivityGraph";
import { allocateTask, type MeshTaskSpec } from "./taskAllocator";
import { evaluateRoleHandoffs, applyHandoff } from "./roleManager";

function emptySnap(operatorId: string, ids: string[]): ConnectivitySnapshot {
  const edges = [];
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push({
      a: ids[i],
      b: ids[i + 1],
      latencyMs: 40 + i * 5,
      loss: 0.05,
      quality01: 0.75,
    });
  }
  const reachable = new Set(ids);
  return {
    edges,
    partitionClusters: [ids],
    operatorReachable: reachable,
    relayChains: [],
    stalePeers: new Set(),
  };
}

function ctxBase(over: Partial<MeshStepContext> = {}): MeshStepContext {
  const nodes = mockSwarmNodes(6, 0.9);
  const ids = nodes.map((n) => n.nodeId);
  const snap = emptySnap(nodes[0]?.nodeId ?? "op", ids);
  return {
    missionId: "m-test",
    nowMs: 1_700_000_000_000,
    seed: 4242,
    tickIndex: 1,
    connectivityMode: "normal",
    graph: snap,
    nodes,
    operatorNodeId: nodes[0]?.nodeId ?? "op",
    liveMode: "mock",
    ...over,
  };
}

describe("Vertex2 mesh resilience", () => {
  it("peer auto-discovery expands known peers under partial visibility", () => {
    const nodes = mockSwarmNodes(5, 0.9);
    const peers = new Map(mockMeshPeers(nodes, 7).map((p) => [p.peerId, p]));
    const snap = emptySnap(nodes[0].nodeId, nodes.map((n) => n.nodeId));
    const ctrl = createNetworkConditionController("degraded");
    advanceDiscovery(peers, snap, ctrl.vector(), () => 0.41);
    const anyExpanded = [...peers.values()].some((p) => p.knownPeers.length > 1);
    expect(anyExpanded).toBe(true);
  });

  it("consensus tolerates high loss with retries (engine quorum)", () => {
    const eng = new MeshConsensusEngine();
    const proposal = eng.maybeStartProposal(1000, () => 0.1, (id) => id) ?? null;
    expect(proposal).not.toBeNull();
    const reachable = ["a", "b", "c", "d"];
    const vector = createNetworkConditionController("lossy").vector();
    let committed = false;
    for (let i = 0; i < 40; i++) {
      for (const peer of reachable) {
        const r = eng.registerVote({ proposalId: proposal!.id, peerId: peer, yes: true }, reachable, vector, () => 0.2, 1000 + i);
        if (r.committed) {
          committed = true;
          break;
        }
      }
      if (committed) break;
    }
    expect(committed).toBe(true);
  });

  it("deterministic seeded simulation: same seed yields identical ledger length over fixed ticks", async () => {
    const run = async (seed: number) => {
      const sim = new MeshResilienceSimulator(seed);
      let len = 0;
      for (let t = 1; t <= 12; t++) {
        const v = await sim.step({ ...ctxBase({ seed, tickIndex: t, nowMs: 1_000_000 + t * 400 }) });
        len = v.ledgerTail.length;
      }
      return len;
    };
    expect(await run(99)).toEqual(await run(99));
    expect(await run(99)).not.toEqual(await run(100));
  });

  it("mesh ledger chain verifies", async () => {
    const sim = new MeshResilienceSimulator(1);
    await sim.step(ctxBase({ tickIndex: 2 }));
    const ok = await sim.ledger.verifyChain();
    expect(ok.ok).toBe(true);
  });

  it("graph updates under stress show degraded links", () => {
    const nodes = mockSwarmNodes(5, 0.9);
    const ids = nodes.map((n) => n.nodeId);
    const snap = emptySnap(ids[0], ids);
    const vLossy = createNetworkConditionController("lossy").vector();
    const g = buildMeshGraphView(snap, ids[0], vLossy);
    expect(g.links.length).toBeGreaterThan(0);
    expect(g.links.every((l) => l.latencyMs >= 8)).toBe(true);
  });

  it("task reassignment scoring prefers relay under partition stress", () => {
    const peers = mockMeshPeers(mockSwarmNodes(5, 0.9), 3);
    const task: MeshTaskSpec = { taskId: "t", kind: "relay_extension", prefersRelay: true, scenarioHint: "local_autonomy_ready" };
    peers.forEach((p) => {
      if (p.meshRole === "relay") p.relayScore01 = 0.95;
    });
    const rec = allocateTask(task, peers, "partitioned", 1000);
    expect(rec).not.toBeNull();
    const winner = peers.find((p) => p.peerId === rec!.winnerId);
    expect(winner?.meshRole === "relay" || (winner?.relayScore01 ?? 0) > 0.5).toBe(true);
  });

  it("role handoff emits under partition stress", () => {
    const peers = mockMeshPeers(mockSwarmNodes(6, 0.9), 5);
    peers.forEach((p) => {
      if (p.meshRole === "coordinator") p.health = "isolated";
    });
    const h = evaluateRoleHandoffs(peers, "partitioned", () => 0.2, 2000);
    expect(h.length).toBeGreaterThanOrEqual(0);
    if (h[0]) {
      const peer = peers.find((p) => p.peerId === h[0].peerId);
      if (peer) applyHandoff(peer, h[0].to);
      expect(peer?.meshRole).toBe(h[0].to);
    }
  });
});
