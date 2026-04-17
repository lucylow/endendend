import { describe, expect, it } from "vitest";
import { coerceMissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { ScenarioCompiler } from "@/backend/shared/mission-policy";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { bootstrapMission, missionEnvelopeView } from "@/backend/api/missions";
import { commitNodeJoin } from "@/backend/api/nodes";
import { StateEnvelopeBuilder } from "@/backend/shared/build-envelope";

describe("ScenarioCompiler + mission scenarios", () => {
  it("compiles collapsed building policy", () => {
    const compiler = new ScenarioCompiler();
    const policy = compiler.compile("collapsed_building");
    expect(policy.roles.find((r) => r.type === "relay")?.minCount).toBe(1);
    expect(policy.safety.maxViolations).toBe(2);
    expect(policy.latticeBudget.minNodes).toBe(5);
  });

  it("normalizes hyphenated scenario ids", () => {
    expect(coerceMissionScenarioKind("collapsed-building")).toBe("collapsed_building");
    const compiler = new ScenarioCompiler();
    expect(compiler.compile("flood-rescue").scenario).toBe("flood_rescue");
  });

  it("emits policy + budget slice on envelope when mission carries scenario", async () => {
    const missionId = "scn-1";
    const registry = new NodeRegistry();
    const { ledger } = await bootstrapMission(missionId, "hq", 1_800_000_000_000, {
      scenario: "collapsed_building",
    });

    await commitNodeJoin(
      ledger,
      registry,
      missionId,
      {
        nodeId: "n1",
        role: "explorer",
        joinedAtMs: 1_800_000_000_001,
        capabilities: ["thermal", "audio", "indoor"],
      },
      1_800_000_000_001,
    );
    await commitNodeJoin(
      ledger,
      registry,
      missionId,
      {
        nodeId: "n2",
        role: "relay",
        joinedAtMs: 1_800_000_000_002,
        capabilities: ["relay", "indoor"],
      },
      1_800_000_000_002,
    );
    registry.heartbeat("n1", { batteryReserve: 0.9, linkQuality: 0.9, sensors: ["thermal", "audio"] }, 1_800_000_000_050);
    registry.heartbeat("n2", { batteryReserve: 0.85, linkQuality: 0.85, sensors: ["indoor"] }, 1_800_000_000_050);

    const env = missionEnvelopeView(ledger, registry, missionId, 1_800_000_000_100);
    expect(env.policy?.scenario).toBe("collapsed_building");
    expect(env.budgetCompliance).toBe(false);
    expect(env.consensusProofs?.length).toBeGreaterThan(0);
    expect(env.mapOverview?.exploredCells).toBe(0);
    expect(env.envelopeVersion).toBe(1);

    const viaClass = StateEnvelopeBuilder.replayFromLedger(ledger, registry, missionId, 1_800_000_000_100);
    expect(viaClass.mission.missionId).toBe(missionId);
    expect(viaClass.policy?.latticeBudget.requiredCapabilities).toContain("thermal");
  });
});
