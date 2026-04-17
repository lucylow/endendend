import { describe, expect, it } from "vitest";
import { bootstrapMission } from "@/backend/api/missions";
import { commitNodeJoin, latticeRecordHeartbeat } from "@/backend/api/nodes";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { ReputationEngine } from "@/backend/lattice/reputation-engine";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { commitVertexBatch, suggestTargetDiscovery } from "@/backend/vertex/consensus-gateway";

function join(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  nodeId: string,
  role: "explorer" | "relay" | "carrier" | "medic" | "observer",
  capabilities: string[],
  t: number,
) {
  return commitNodeJoin(ledger, registry, missionId, { nodeId, role, joinedAtMs: t, capabilities }, t);
}

describe("Lattice reputation + scenario budgets", () => {
  it("raises trust on proofs and heartbeats, lowers on safety failures", async () => {
    const missionId = "m-rep";
    const ledger = new MissionLedger();
    const t0 = 1_800_000_000_000;
    await ledger.append({
      missionId,
      actorId: "hq",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "init", name: missionId },
      timestamp: t0,
      previousHash: ledger.tailHash(),
    });
    const registry = new NodeRegistry();
    await join(ledger, registry, missionId, "n1", "explorer", ["thermal"], t0 + 1);

    await latticeRecordHeartbeat(ledger, registry, missionId, "n1", t0 + 2, { batteryReserve: 0.9, linkQuality: 0.8, sensors: ["thermal"] });
    await commitVertexBatch(ledger, [suggestTargetDiscovery(missionId, "n1", "tgt-1", t0 + 3, "victim")]);
    await ledger.append({
      missionId,
      actorId: "n1",
      eventType: "safety_alert",
      plane: "vertex",
      payload: { kind: "geofence", message: "breach", level: "warn" },
      timestamp: t0 + 4,
      previousHash: ledger.tailHash(),
    });

    const engine = new ReputationEngine(ledger, { persistToLedger: false });
    const s = engine.evaluateFromLedger("n1", missionId);
    expect(s.proofContributions).toBeGreaterThanOrEqual(1);
    expect(s.uptime).toBeGreaterThanOrEqual(1);
    expect(s.violations).toBe(1);
    expect(s.finalScore).toBeGreaterThanOrEqual(0);
    expect(s.finalScore).toBeLessThanOrEqual(1);
  });

  it("persists reputation_update on the lattice plane", async () => {
    const missionId = "m-rep2";
    const registry = new NodeRegistry();
    const { ledger } = await bootstrapMission(missionId, "hq", 1_810_000_000_000);
    await join(ledger, registry, missionId, "a1", "relay", ["relay", "audio"], 1_810_000_000_001);
    await latticeRecordHeartbeat(ledger, registry, missionId, "a1", 1_810_000_000_002, { batteryReserve: 0.85, sensors: ["thermal", "audio"] });

    const engine = new ReputationEngine(ledger);
    const row = await engine.computeScore("a1", missionId, 1_810_000_000_010);
    expect(row.updateEventHash).toMatch(/^[a-f0-9]{64}$/);
    const last = ledger.head();
    expect(last?.eventType).toBe("reputation_update");
    expect(last?.plane).toBe("lattice");
  });

  it("ranks explorers by blended reputation + role fit", async () => {
    const missionId = "m-rank";
    const ledger = new MissionLedger();
    const t0 = 1_820_000_000_000;
    await ledger.append({
      missionId,
      actorId: "hq",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "discovery" },
      timestamp: t0,
      previousHash: ledger.tailHash(),
    });
    const registry = new NodeRegistry();
    await join(ledger, registry, missionId, "x1", "explorer", ["thermal"], t0 + 1);
    await join(ledger, registry, missionId, "x2", "observer", [], t0 + 2);
    await commitVertexBatch(ledger, [suggestTargetDiscovery(missionId, "x1", "t1", t0 + 5)]);

    const engine = new ReputationEngine(ledger, { persistToLedger: false });
    const order = engine.rankNodesForTask(missionId, "explorer", t0 + 9);
    expect(order[0]).toBe("x1");
  });

  it("collapsed_building budget passes when roster + telemetry meet floors", async () => {
    const missionId = "m-bud";
    const registry = new NodeRegistry();
    const { ledger } = await bootstrapMission(missionId, "hq", 1_830_000_000_000);
    const t = 1_830_000_000_000;
    const nodes: Array<{ id: string; role: "explorer" | "relay" | "carrier" | "medic"; caps: string[] }> = [
      { id: "r1", role: "relay", caps: ["relay", "thermal", "audio"] },
      { id: "e1", role: "explorer", caps: ["thermal", "audio"] },
      { id: "e2", role: "explorer", caps: ["thermal", "audio"] },
      { id: "c1", role: "carrier", caps: ["carrier", "thermal"] },
      { id: "m1", role: "medic", caps: ["medic", "audio"] },
    ];
    let tick = 1;
    for (const n of nodes) {
      await join(ledger, registry, missionId, n.id, n.role, n.caps, t + tick);
      registry.heartbeat(n.id, { batteryReserve: 0.75, linkQuality: 0.85, sensors: n.caps }, t + 50);
      tick++;
    }
    const mission = replayMissionFromLedger(ledger.toArray(), missionId);
    const gate = registry.validateScenarioBudget("collapsed_building", mission, t + 100, 60_000);
    expect(gate.ok).toBe(true);
  });

  it("rejects hazmat when gas sensor redundancy is missing", async () => {
    const missionId = "m-haz";
    const registry = new NodeRegistry();
    const ledger = new MissionLedger();
    const t = 1_840_000_000_000;
    await ledger.append({
      missionId,
      actorId: "hq",
      eventType: "mission_created",
      plane: "vertex",
      payload: { phase: "init" },
      timestamp: t,
      previousHash: ledger.tailHash(),
    });
    const squad: Array<{ id: string; role: "explorer" | "relay" | "carrier" | "medic"; caps: string[]; tel: string[] }> = [
      { id: "h0", role: "relay", caps: ["relay", "gas", "thermal"], tel: ["gas", "thermal"] },
      { id: "h1", role: "relay", caps: ["relay", "thermal"], tel: ["thermal"] },
      { id: "h2", role: "explorer", caps: ["thermal"], tel: ["thermal"] },
      { id: "h3", role: "carrier", caps: ["carrier", "thermal"], tel: ["thermal"] },
      { id: "h4", role: "medic", caps: ["medic", "thermal"], tel: ["thermal"] },
    ];
    let tick = 1;
    for (const n of squad) {
      await join(ledger, registry, missionId, n.id, n.role, n.caps, t + tick);
      registry.heartbeat(n.id, { batteryReserve: 0.7, linkQuality: 0.9, sensors: n.tel }, t + 50);
      tick++;
    }
    const mission = replayMissionFromLedger(ledger.toArray(), missionId);
    const gate = registry.validateScenarioBudget("hazmat", mission, t + 100, 60_000);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain("gas_redundancy");
  });
});
