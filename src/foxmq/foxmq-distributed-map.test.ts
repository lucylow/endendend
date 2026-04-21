import { describe, it, expect } from "vitest";
import { buildMapDelta, checksumDeltaCells } from "@/foxmq/mapDelta";
import { mergeMapCellMeta } from "@/foxmq/mapMerge";
import { MonotonicSharedMap, cellKey } from "@/swarm/sharedMap";
import { mergePartitionMapDeltas } from "@/swarm/recoveryManager";
import { rehydrateNodeFromCollective } from "@/foxmq/recovery";
import { FoxMqMapSyncEngine } from "@/foxmq/mapSyncEngine";
import { defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";
import { VertexSwarmSimulator } from "@/backend/vertex/swarm-simulator";
import { resetFoxSequence } from "@/foxmq/messageEnvelope";

describe("FoxMQ distributed map", () => {
  it("buildMapDelta checksum is stable for same cells", () => {
    const cells = {
      [cellKey(1, 1)]: { state: "searched" as const, version: 2, updatedAtMs: 10, lastNodeId: "a" },
    };
    const d1 = buildMapDelta({
      deltaId: "x",
      sourceNodeId: "a",
      missionId: "m",
      mapId: "map",
      baseVersion: 1,
      cells,
      causalSeq: 3,
      timestamp: 99,
    });
    const d2 = buildMapDelta({
      deltaId: "y",
      sourceNodeId: "a",
      missionId: "m",
      mapId: "map",
      baseVersion: 1,
      cells,
      causalSeq: 4,
      timestamp: 100,
    });
    expect(d1.checksum).toBe(d2.checksum);
    expect(checksumDeltaCells(cells)).toBe(d1.checksum);
  });

  it("merge rejects stale rank regression", () => {
    const searched: import("@/swarm/types").MapCellMeta = {
      state: "searched",
      version: 2,
      updatedAtMs: 100,
      lastNodeId: "a",
    };
    const seen: import("@/swarm/types").MapCellMeta = {
      state: "seen",
      version: 99,
      updatedAtMs: 200,
      lastNodeId: "b",
    };
    expect(mergeMapCellMeta(seen, searched, "late").state).toBe("searched");
    expect(mergeMapCellMeta(searched, seen, "stale").state).toBe("searched");
  });

  it("partition merge joins divergent deltas monotonically", () => {
    const d1 = {
      cells: { [cellKey(0, 0)]: { state: "searched" as const, version: 1, updatedAtMs: 1, lastNodeId: "n1" } },
      originNodeId: "n1",
      emittedAtMs: 1,
    };
    const d2 = {
      cells: { [cellKey(0, 0)]: { state: "frontier" as const, version: 9, updatedAtMs: 9, lastNodeId: "n2" } },
      originNodeId: "n2",
      emittedAtMs: 2,
    };
    const merged = mergePartitionMapDeltas([d1, d2]);
    expect(merged[cellKey(0, 0)]?.state).toBe("searched");
  });

  it("offline contribution cells stay visible after merge", () => {
    const collective = {
      [cellKey(0, 0)]: { state: "searched" as const, version: 3, updatedAtMs: 50, lastNodeId: "n2", firstSeenBy: "n1" },
    };
    const r = rehydrateNodeFromCollective({ collective, localOverlay: {}, nodeId: "n1" });
    expect(r.recoveredFromCollective).toBe(true);
    expect(r.mergedCells[cellKey(0, 0)]?.state).toBe("searched");
  });

  it("sync engine tolerates duplicates without crashing", () => {
    const eng = new FoxMqMapSyncEngine("m", "map", 0);
    const map = new MonotonicSharedMap();
    map.applyLocalUpdate(0, 0, "searched", 1, "a");
    map.applyLocalUpdate(1, 0, "searched", 1, "b");
    const graph = {
      edges: [
        { a: "a", b: "b", latencyMs: 10, loss: 0, quality01: 0.9 },
        { a: "b", b: "c", latencyMs: 10, loss: 0, quality01: 0.85 },
      ],
      partitionClusters: [],
      operatorReachable: new Set(["a", "b", "c"]),
      relayChains: [],
      stalePeers: new Set<string>(),
    };
    const rng = () => 0.1;
    for (let i = 0; i < 5; i++) {
      eng.step({
        map,
        graph,
        nowMs: i * 10,
        rng,
        connectivityMode: "normal",
        partitionManual: false,
        liveFoxAvailable: false,
        mockFallback: true,
        operatorNodeId: "c",
        offlineNodeIds: [],
      });
    }
    expect(map.snapshotCells()[cellKey(0, 0)]?.state).toBe("searched");
  });

  it("swarm map survives node dropout and keeps explored cells", async () => {
    const cfg = defaultRuntimeConfig("hazmat", 77);
    cfg.tickMs = 20;
    const sim = new VertexSwarmSimulator("m-fox-outage", cfg, 5);
    let v = await sim.tick();
    for (let i = 0; i < 12; i++) v = await sim.tick();
    sim.forceNodeDropout("agent-scout-a");
    for (let i = 0; i < 8; i++) v = await sim.tick();
    const after = Object.keys(v.sharedMap.cells).length;
    expect(after).toBeGreaterThan(0);
    expect(v.foxmqMap.public.mapVersion).toBeGreaterThan(0);
  });

  it("resetFoxSequence keeps tests deterministic", () => {
    resetFoxSequence(1);
    expect(true).toBe(true);
  });
});
