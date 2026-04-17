import { describe, expect, it } from "vitest";
import {
  CellState,
  type MissionStateMachine,
  MissionStateMachine,
  MonotonicSharedMap,
  NodeRole,
  TransitionReason,
  missionStateFromMachine,
  missionStateMachineSmokeDemo,
} from "@/backend/shared/tashi-mission-map-machine";
import { sarProjectionFromEnvelope } from "@/backend/api/snapshot-bridge";
import { buildTashiStateEnvelope } from "@/backend/shared/build-envelope";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import { NodeRegistry } from "@/backend/lattice/node-registry";

describe("MonotonicSharedMap", () => {
  it("keeps monotonic state when merging concurrent observations", () => {
    const map = new MonotonicSharedMap("m1");
    map.markSeen(0, 0, 0, "a", 0.5);
    const stale = map.cell("0:0:0");
    expect(stale).not.toBeNull();

    const remote: NonNullable<typeof stale> = {
      ...stale!,
      state: CellState.Searched,
      confidence: 0.95,
      lastSeenMs: stale!.lastSeenMs + 1,
      version: stale!.version + 5,
      metadata: { from: "remote" },
    };

    map.merge([remote], 0, "b");
    const merged = map.cell("0:0:0");
    expect(merged?.state).toBe(CellState.Searched);
    expect(merged?.metadata).toMatchObject({ from: "remote" });
  });

  it("delta only clears dirty entries that were flushed, not the whole dirty set", () => {
    const map = new MonotonicSharedMap("m2");
    for (let i = 0; i < 5; i++) {
      map.markSeen(i, 0, 0, "n1", 0.4);
    }
    expect(map.dirtyCount()).toBe(5);

    const d = map.delta(2, "sync", "n1");
    expect(d.cells.length).toBe(2);
    expect(map.dirtyCount()).toBe(3);
    expect(d.baseVersion).toBeGreaterThanOrEqual(0);
    expect(d.metadata).toMatchObject({ flushed: 2, remainingDirty: 3 });
  });

  it("does not bump map version on no-op merges", () => {
    const map = new MonotonicSharedMap("m3");
    map.markSeen(1, 1, 0, "a");
    const v0 = map.getVersion();
    const cell = map.cell("1:1:0")!;
    map.merge([{ ...cell }], map.getVersion(), "remote");
    expect(map.getVersion()).toBe(v0);
  });
});

describe("MissionStateMachine", () => {
  it("rejects illegal phase jumps", () => {
    const map = new MonotonicSharedMap("m");
    const m = new MissionStateMachine("mid", map, { minQuorumNodes: 1, minCoveragePct: 0 });
    m.registerNode({
      nodeId: "n1",
      role: NodeRole.Explorer,
      batteryPct: 90,
      linkQuality: 0.9,
      gpsFix: true,
      lastSeenMs: Date.now(),
      active: true,
      capabilities: [],
    });
    const tx = m.transition("rescue", "n1", TransitionReason.OperatorOverride);
    expect(tx.accepted).toBe(false);
    expect(m.phase).toBe("init");
  });

  it("allows Vertex-aligned search → discovery rollback when gates pass", () => {
    const map = new MonotonicSharedMap("m-roll");
    const m = new MissionStateMachine("mid", map, { minQuorumNodes: 1, minCoveragePct: 0, requiredRoles: {} });
    const hb = { batteryPct: 90, linkQuality: 0.9, gpsFix: true, lastSeenMs: Date.now(), active: true, capabilities: [] };
    m.registerNode({ nodeId: "n1", role: NodeRole.Explorer, ...hb });
    m.registerNode({ nodeId: "n2", role: NodeRole.Relay, ...hb });
    m.transition("discovery", "n1", TransitionReason.QuorumReached);
    map.markSeen(0, 0, 0, "n1");
    m.transition("search", "n1", TransitionReason.CoverageReached);
    expect(m.phase).toBe("search");
    const back = m.transition("discovery", "n1", TransitionReason.OperatorOverride);
    expect(back.accepted).toBe(true);
    expect(m.phase).toBe("discovery");
  });
});

describe("missionStateMachineSmokeDemo", () => {
  it("runs end-to-end without throwing", () => {
    const out = missionStateMachineSmokeDemo();
    expect(out.phase).toBe("complete");
    expect(Array.isArray(out.transitions)).toBe(true);
  });
});

describe("missionStateFromMachine + envelope", () => {
  it("maps machine snapshot into MissionState and snapshot-bridge projection", () => {
    const { machine } = missionStateMachineSmokeDemo() as { machine: MissionStateMachine };
    const mission = missionStateFromMachine(machine, Date.now());
    expect(mission.phase).toBe("complete");
    expect(mission.mapSummary.cellsKnown).toBeGreaterThan(0);

    const ledger = { head: () => null } as Pick<MissionLedger, "head"> as MissionLedger;
    const registry = new NodeRegistry();
    const env = buildTashiStateEnvelope(mission, ledger, registry, Date.now());
    const sar = sarProjectionFromEnvelope(env);
    expect(sar.missionPhase).toBe("complete");
    expect(sar.latticeOnline).toBe(0);
  });
});
