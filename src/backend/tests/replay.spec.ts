import { describe, expect, it } from "vitest";
import { buildRewardManifest } from "@/backend/arc/reward-manifest";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { MissionReplayer } from "@/backend/replay/mission-replayer";
import { SettlementQueue } from "@/backend/settlement/settlement-queue";
import { MissionLedger } from "@/backend/vertex/mission-ledger";

async function seedDemoMission(ledger: MissionLedger, missionId: string): Promise<void> {
  let prev = "genesis";
  const stamp = (i: number) => 1_700_000_000_000 + i;

  const push = async (input: Omit<Parameters<MissionLedger["append"]>[0], "previousHash">) => {
    const e = await ledger.append({ ...input, previousHash: prev });
    prev = e.eventHash;
  };

  await push({
    missionId,
    actorId: "control",
    eventType: "mission_created",
    plane: "vertex",
    payload: { phase: "discovery", scenario: "collapsed_building", cellsKnown: 4 },
    timestamp: stamp(0),
  });
  await push({
    missionId,
    actorId: "control",
    eventType: "phase_transition",
    plane: "vertex",
    payload: { toPhase: "search" },
    timestamp: stamp(1),
  });
  await push({
    missionId,
    actorId: "drone-3",
    eventType: "node_join",
    plane: "vertex",
    payload: { nodeId: "drone-3", role: "explorer", capabilities: ["thermal"] },
    timestamp: stamp(2),
  });
  await push({
    missionId,
    actorId: "drone-3",
    eventType: "target_discovered",
    plane: "vertex",
    payload: { targetId: "t-42", notes: "heat signature" },
    timestamp: stamp(3),
  });
  await push({
    missionId,
    actorId: "drone-1",
    eventType: "target_confirmed",
    plane: "vertex",
    payload: { targetId: "t-42" },
    timestamp: stamp(4),
  });
  await push({
    missionId,
    actorId: "drone-1",
    eventType: "phase_transition",
    plane: "vertex",
    payload: { toPhase: "complete" },
    timestamp: stamp(5),
  });
}

describe("MissionReplayer", () => {
  it("replays deterministically and validates chain semantics", async () => {
    const ledger = new MissionLedger();
    const missionId = "demo-mission";
    await seedDemoMission(ledger, missionId);

    const replayer = new MissionReplayer(ledger);
    const replay1 = await replayer.replayMission(missionId);
    const replay2 = await replayer.replayMission(missionId);

    expect(replay1.report.verification.deterministic).toBe(true);
    expect(replay1.report.verification.consensusOrderValid).toBe(true);
    expect(replay1.report.finalStateFingerprint).toBe(replay2.report.finalStateFingerprint);
    expect(JSON.stringify(replay1.steps.map((s) => s.event.eventHash))).toEqual(
      JSON.stringify(replay2.steps.map((s) => s.event.eventHash)),
    );

    const discovered = replay1.steps.find((s) => s.event.eventType === "target_discovered");
    expect(discovered?.envelopeAfter.mapOverview?.targets.some((t) => t.id === "t-42")).toBe(true);
  });

  it("supports event index windows", async () => {
    const ledger = new MissionLedger();
    const missionId = "w";
    await seedDemoMission(ledger, missionId);
    const replayer = new MissionReplayer(ledger);
    const tail = await replayer.replayMission(missionId, 4);
    expect(tail.steps.length).toBe(2);
    expect(tail.steps[0]?.event.eventType).toBe("target_confirmed");
  });
});

describe("SettlementQueue", () => {
  it("processes FIFO without blocking enqueue", async () => {
    const hashes: string[] = [];
    const q = new SettlementQueue(async (_id, manifest) => {
      hashes.push(manifest.missionId);
      return `tx-${manifest.verification.vertexLedgerTail.slice(0, 8)}`;
    });

    const ledger = new MissionLedger();
    await seedDemoMission(ledger, "m-a");
    await seedDemoMission(ledger, "m-b");
    const registry = new NodeRegistry();

    const a = await buildRewardManifest(ledger, registry, "m-a", 9);
    const b = await buildRewardManifest(ledger, registry, "m-b", 9);

    q.enqueue("m-a", a);
    q.enqueue("m-b", b);

    await q.flush();

    expect(hashes).toEqual(["m-a", "m-b"]);
    expect(q.getStatus("m-a")?.status).toBe("settled");
    expect(q.getStatus("m-b")?.status).toBe("settled");
    expect(q.getStatus("m-a")?.arcTxHash).toMatch(/^tx-/);
  });

  it("marks failed settlements", async () => {
    const q = new SettlementQueue(async () => {
      throw new Error("bridge_down");
    });
    const ledger = new MissionLedger();
    await seedDemoMission(ledger, "m-x");
    const registry = new NodeRegistry();
    const manifest = await buildRewardManifest(ledger, registry, "m-x", 9);

    q.enqueue("m-x", manifest);
    await q.flush();

    expect(q.getStatus("m-x")?.status).toBe("failed");
    expect(q.getStatus("m-x")?.error).toContain("bridge_down");
  });
});
