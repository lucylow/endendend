import { describe, expect, it } from "vitest";
import { buildTashiStateEnvelope } from "@/backend/shared/build-envelope";
import { bootstrapMission } from "@/backend/api/missions";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { commitNodeJoin } from "@/backend/api/nodes";
import {
  mergeSwarmSnapshotHints,
  normalizeBackendEnvelopeToFlat,
  normalizeMapGridFromCells,
  settlementPreviewFromEnvelope,
} from "./normalizers";

describe("normalizeBackendEnvelopeToFlat", () => {
  it("maps mission fields and preserves backend reference", async () => {
    const { ledger } = await bootstrapMission("m-test", "op", 1_700_000_000_000, {
      scenario: "collapsed_building",
    });
    const registry = new NodeRegistry();
    await commitNodeJoin(
      ledger,
      registry,
      "m-test",
      {
        nodeId: "n1",
        role: "explorer",
        joinedAtMs: 1_700_000_000_001,
        capabilities: ["thermal"],
      },
      1_700_000_000_001,
    );
    registry.heartbeat("n1", { batteryReserve: 0.8, linkQuality: 0.9, sensors: ["thermal"] }, 1_700_000_000_002);
    const env = buildTashiStateEnvelope(
      (await import("@/backend/vertex/demo-replay")).replayMissionFromLedger(ledger.toArray(), "m-test"),
      ledger,
      registry,
      1_700_000_000_010,
      { allocationTaskType: "explorer" },
    );
    const flat = normalizeBackendEnvelopeToFlat(env, "local_engine", registry, 1_700_000_000_010);
    expect(flat.missionId).toBe("m-test");
    expect(flat.backend).toBe(env);
    expect(flat.nodes.some((n) => n.nodeId === "n1")).toBe(true);
  });
});

describe("settlementPreviewFromEnvelope", () => {
  it("returns pending-seal view for terminal mission without arc", async () => {
    const { ledger } = await bootstrapMission("m2", "op", 1, { scenario: "tunnel" });
    const registry = new NodeRegistry();
    const mission = (await import("@/backend/vertex/demo-replay")).replayMissionFromLedger(ledger.toArray(), "m2");
    const env = buildTashiStateEnvelope({ ...mission, phase: "complete" }, ledger, registry, 10, {});
    const prev = settlementPreviewFromEnvelope(env, "0xabc", "local_engine");
    expect(prev?.ready).toBe(true);
    expect(prev?.manifestHash).toBe("pending-seal");
  });
});

describe("normalizeMapGridFromCells", () => {
  it("is deterministic for same seed", () => {
    const a = normalizeMapGridFromCells(24, "seed-a", "mock");
    const b = normalizeMapGridFromCells(24, "seed-a", "mock");
    expect(a.grid.length).toBe(b.grid.length);
    expect(a.grid[0]?.state).toBe(b.grid[0]?.state);
  });
});

describe("mergeSwarmSnapshotHints", () => {
  it("overlays SAR hints onto base envelope", () => {
    const base = mergeSwarmSnapshotHints(
      {
        node: {},
        presence: {},
        missions: [],
        history_tail: [],
        ts_ms: 99,
        tashi: {
          mesh: {},
          registers: { keys: [], worldMap: {} },
          chainHint: { storeMetrics: {} },
          missionsBrief: [],
          historyTail: [],
          sar: { missionPhase: "search", latticeOnline: 3 },
        },
      },
      {
        missionId: "m0",
        scenario: "collapsed_building",
        phase: "discovery",
        mapSummary: { exploredCells: 10, coveragePercent: 20, targets: [] },
        nodes: [],
        alerts: [],
        recovery: { state: "recovered", checkpointLag: 0, mapLagPct: 0 },
        source: "mock",
      },
    );
    expect(base.phase).toBe("search");
    expect(base.capturedAtMs).toBe(99);
    expect(base.source).toBe("live_http");
  });
});
