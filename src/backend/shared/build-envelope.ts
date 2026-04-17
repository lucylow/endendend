import type { SettlementManifest } from "@/backend/arc/settlement-manifest";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MissionState } from "./mission-state";
import { ScenarioCompiler } from "./mission-policy";
import type { TashiStateEnvelope } from "./tashi-state-envelope";

const scenarioCompiler = new ScenarioCompiler();

const PROOF_TAIL = 24;

function missionLedgerTail(ledger: MissionLedger, missionId: string) {
  const mine = ledger.eventsForMission(missionId);
  return mine.length ? mine[mine.length - 1] : ledger.head();
}

function vertexProofHashes(ledger: MissionLedger, missionId: string, max: number): string[] {
  return ledger
    .eventsForMission(missionId)
    .filter((e) => e.plane === "vertex")
    .slice(-max)
    .map((e) => e.eventHash);
}

function coverageFromCells(cells: number): number {
  return Math.min(100, Math.round(cells > 0 ? Math.min(100, 8 + Math.sqrt(cells) * 4) : 0));
}

export type BuildEnvelopeOptions = {
  settlement?: SettlementManifest;
};

export function buildTashiStateEnvelope(
  mission: MissionState,
  ledger: MissionLedger,
  registry: NodeRegistry,
  nowMs: number,
  opts?: BuildEnvelopeOptions,
): TashiStateEnvelope {
  const head = ledger.head();
  const tail = missionLedgerTail(ledger, mission.missionId);
  const scenario = mission.scenario ?? "collapsed_building";
  const policy = mission.scenario ? scenarioCompiler.compile(mission.scenario) : undefined;
  const budget = mission.scenario
    ? registry.validateScenarioBudget(mission.scenario, mission, nowMs, 30_000)
    : undefined;

  const cells = mission.mapSummary.cellsKnown ?? 0;
  const mapOverview = {
    exploredCells: cells,
    coveragePercent: coverageFromCells(cells),
    targets: Object.values(mission.targets).map((t) => ({
      id: t.targetId,
      status: t.confirmedByVertex ? "confirmed" : "provisional",
      confidence: t.confirmedByVertex ? 1 : 0.55,
    })),
  };

  const activeTasks = Object.values(mission.assignments).map((a) => ({
    id: a.taskId,
    type: a.taskType,
    assignee: a.nodeId,
    status: "assigned" as const,
  }));

  const alertStream = mission.alerts.map((a) => ({
    type: a.message || a.level,
    severity: (a.level === "critical" ? "critical" : "warning") as "warning" | "critical",
    nodeId: a.sourceNodeId ?? "mission",
  }));

  const batteryFloor = policy?.safety.batteryThreshold ?? 0.2;
  const swarmHealth = registry.swarmHealthSummary(mission, nowMs, 30_000, batteryFloor);

  return {
    mission,
    vertex: {
      lastCommittedHash: head?.eventHash ?? mission.consensusPointer.lastEventHash,
      sequence: mission.consensusPointer.sequence,
    },
    lattice: registry.exportSnapshot(nowMs, scenario),
    ...(opts?.settlement ? { settlement: opts.settlement } : {}),
    ...(policy ? { policy } : {}),
    ...(budget ? { budgetCompliance: budget.ok } : {}),
    ...(tail ? { ledgerTail: tail } : {}),
    consensusProofs: vertexProofHashes(ledger, mission.missionId, PROOF_TAIL),
    mapOverview,
    activeTasks,
    alertStream,
    swarmHealth,
    replayRoot: tail?.eventHash ?? head?.eventHash ?? mission.consensusPointer.lastEventHash,
    syncStatus: "synced",
    envelopeVersion: 1,
    capturedAtMs: nowMs,
  };
}

/** Convenience for ledger-only replay + envelope materialization. */
export class StateEnvelopeBuilder {
  static build(
    mission: MissionState,
    ledger: MissionLedger,
    registry: NodeRegistry,
    nowMs: number,
    opts?: BuildEnvelopeOptions,
  ): TashiStateEnvelope {
    return buildTashiStateEnvelope(mission, ledger, registry, nowMs, opts);
  }

  static replayFromLedger(
    ledger: MissionLedger,
    registry: NodeRegistry,
    missionId: string,
    nowMs: number,
    opts?: BuildEnvelopeOptions,
  ): TashiStateEnvelope {
    const mission = replayMissionFromLedger(ledger.toArray(), missionId);
    return buildTashiStateEnvelope(mission, ledger, registry, nowMs, opts);
  }
}
