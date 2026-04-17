import { ScenarioCompiler } from "@/backend/shared/mission-policy";
import { emptyMissionState, type MissionState } from "@/backend/shared/mission-state";
import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import { applyMissionLedgerEvent, replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { stableStringify } from "@/backend/vertex/hash-chain";
import type { MissionLedger, MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

export interface ReplayStep {
  eventIndex: number;
  event: MissionLedgerEvent;
  stateBefore: MissionState;
  stateAfter: MissionState;
  envelopeAfter: TashiStateEnvelope;
  phaseChange?: boolean;
  assignmentChange?: { nodeId: string; task: string };
  safetyEvent?: boolean;
  debugNotes: string[];
}

export interface ReplayReport {
  missionId: string;
  totalEvents: number;
  phaseHistory: string[];
  keyMoments: Array<{
    timestamp: number;
    description: string;
    nodesInvolved: string[];
  }>;
  verification: {
    deterministic: boolean;
    consensusOrderValid: boolean;
    finalMapConsistent: boolean;
  };
  operatorSummary: string;
  /** Stable digest of final ``MissionState`` for cross-run equality checks. */
  finalStateFingerprint: string;
}

function missionEnvelope(state: MissionState, policyFromCompiler: ReturnType<ScenarioCompiler["tryCompile"]>, tail: MissionLedgerEvent | undefined): TashiStateEnvelope {
  const rosterIds = Object.keys(state.roster);
  const trust: Record<string, number> = {};
  for (const id of rosterIds) trust[id] = 1;
  const coveragePercent = Math.min(
    100,
    Math.round(state.mapSummary.cellsKnown > 0 ? Math.min(100, 8 + Math.sqrt(state.mapSummary.cellsKnown) * 4) : 0),
  );
  return {
    mission: state,
    vertex: {
      lastCommittedHash: state.consensusPointer.lastEventHash,
      sequence: state.consensusPointer.sequence,
    },
    lattice: {
      capturedAtMs: state.updatedAtMs,
      onlineNodeIds: rosterIds,
      trustScores: trust,
      capacityHints: {},
    },
    policy: policyFromCompiler,
    ledgerTail: tail,
    mapOverview: {
      exploredCells: state.mapSummary.cellsKnown,
      coveragePercent,
      targets: Object.values(state.targets).map((t) => ({
        id: t.targetId,
        status: t.confirmedByVertex ? "confirmed" : "discovered",
        confidence: t.confirmedByVertex ? 1 : 0.75,
      })),
    },
    activeTasks: Object.values(state.assignments).map((a) => ({
      id: a.taskId,
      type: a.taskType,
      assignee: a.nodeId,
      status: "assigned" as const,
    })),
    alertStream: state.alerts.map((a) => ({
      type: "safety",
      severity: a.level === "critical" ? ("critical" as const) : ("warning" as const),
      nodeId: a.sourceNodeId ?? "",
    })),
  };
}

function fingerprintState(state: MissionState): string {
  return stableStringify(state);
}

function missionEventsOrdered(ledger: MissionLedger, missionId: string): MissionLedgerEvent[] {
  return ledger.eventsForMission(missionId);
}

/** Each mission event must link to the global row immediately before it in the ledger. */
function verifyMissionEventsAgainstGlobalChain(
  globalEvents: MissionLedgerEvent[],
  missionEvents: MissionLedgerEvent[],
): boolean {
  const indexByHash = new Map<string, number>();
  for (let i = 0; i < globalEvents.length; i++) indexByHash.set(globalEvents[i].eventHash, i);
  for (const e of missionEvents) {
    const idx = indexByHash.get(e.eventHash);
    if (idx === undefined) return false;
    const prevGlobal = idx > 0 ? globalEvents[idx - 1] : null;
    const expectedPrev = prevGlobal?.eventHash ?? "genesis";
    if (e.previousHash !== expectedPrev) return false;
  }
  return true;
}

function isPhaseChange(event: MissionLedgerEvent): boolean {
  return event.eventType === "phase_transition" || event.eventType === "mission_created";
}

function isAssignment(event: MissionLedgerEvent): boolean {
  return event.eventType === "task_assigned";
}

function isSafetyEvent(event: MissionLedgerEvent): boolean {
  return event.eventType === "safety_alert";
}

function parseAssignment(event: MissionLedgerEvent): { nodeId: string; task: string } {
  return {
    nodeId: String(event.payload.nodeId ?? event.actorId),
    task: String(event.payload.taskType ?? event.payload.taskId ?? ""),
  };
}

function describeKeyMoment(e: MissionLedgerEvent): { description: string; nodes: string[] } | null {
  switch (e.eventType) {
    case "target_discovered":
      return {
        description: `${e.actorId} discovered target ${String(e.payload.targetId ?? "?")}`,
        nodes: [e.actorId].filter(Boolean),
      };
    case "target_confirmed":
      return {
        description: `Target ${String(e.payload.targetId ?? "?")} confirmed`,
        nodes: [e.actorId, String(e.payload.confirmedBy ?? "")].filter(Boolean),
      };
    case "phase_transition":
      return {
        description: `Phase → ${String(e.payload.toPhase ?? "?")}`,
        nodes: [],
      };
    case "task_assigned":
      return {
        description: `Task ${String(e.payload.taskType ?? e.payload.taskId ?? "")} → ${String(e.payload.nodeId ?? "")}`,
        nodes: [String(e.payload.nodeId ?? e.actorId)],
      };
    case "safety_alert":
      return {
        description: `Safety: ${String(e.payload.message ?? e.payload.alertId ?? "alert")}`,
        nodes: [e.actorId],
      };
    case "extraction_confirmed":
      return {
        description: `Extraction confirmed for target ${String(e.payload.targetId ?? "?")}`,
        nodes: [e.actorId],
      };
    default:
      return null;
  }
}

function buildPrefixState(ordered: MissionLedgerEvent[], missionId: string, prefixLen: number): MissionState {
  const t0 =
    ordered.find((e) => e.eventType === "mission_created")?.timestamp ?? ordered[0]?.timestamp ?? Date.now();
  let state = emptyMissionState(missionId, t0);
  for (let i = 0; i < prefixLen; i++) {
    state = applyMissionLedgerEvent(state, ordered[i]);
  }
  return state;
}

export class MissionReplayer {
  private readonly ledger: MissionLedger;
  private readonly compiler: ScenarioCompiler;

  constructor(ledger: MissionLedger, compiler: ScenarioCompiler = new ScenarioCompiler()) {
    this.ledger = ledger;
    this.compiler = compiler;
  }

  /**
   * Reconstruct mission state stepwise from the append-only ledger.
   * ``fromEvent`` / ``toEvent`` are indices into the per-mission ordered event list.
   */
  async replayMission(
    missionId: string,
    fromEvent = 0,
    toEvent?: number,
  ): Promise<{ steps: ReplayStep[]; report: ReplayReport }> {
    const ordered = missionEventsOrdered(this.ledger, missionId);
    const end = toEvent ?? ordered.length;
    const from = Math.max(0, Math.min(fromEvent, ordered.length));
    const to = Math.max(from, Math.min(end, ordered.length));

    let state = buildPrefixState(ordered, missionId, from);
    const slice = ordered.slice(from, to);
    const steps: ReplayStep[] = [];

    for (let i = 0; i < slice.length; i++) {
      const event = slice[i];
      const stateBefore = structuredClone(state);
      state = applyMissionLedgerEvent(state, event);

      const policy = this.compiler.tryCompile(state.scenario ?? "collapsed_building");

      const step: ReplayStep = {
        eventIndex: from + i,
        event,
        stateBefore,
        stateAfter: state,
        envelopeAfter: missionEnvelope(state, policy, event),
        debugNotes: [
          `Event @${from + i}: ${event.eventType}`,
          `Actor: ${event.actorId}`,
          `Roster: ${Object.keys(state.roster).length}`,
          `Targets: ${Object.keys(state.targets).length}`,
          `Alerts: ${state.alerts.length}`,
        ],
      };

      if (isPhaseChange(event)) step.phaseChange = true;
      if (isAssignment(event)) step.assignmentChange = parseAssignment(event);
      if (isSafetyEvent(event)) step.safetyEvent = true;

      steps.push(step);
    }

    const report = await this.generateReport({
      missionId,
      ordered,
      slice,
      steps,
      finalState: state,
      ledger: this.ledger,
    });

    return { steps, report };
  }

  private async generateReport(ctx: {
    missionId: string;
    ordered: MissionLedgerEvent[];
    slice: MissionLedgerEvent[];
    steps: ReplayStep[];
    finalState: MissionState;
    ledger: MissionLedger;
  }): Promise<ReplayReport> {
    const { missionId, ordered, slice, steps, finalState, ledger } = ctx;

    const phaseHistory = steps.filter((s) => s.phaseChange).map((s) => s.event.eventType);

    const keyMoments: ReplayReport["keyMoments"] = [];
    for (const e of slice) {
      const m = describeKeyMoment(e);
      if (m) {
        keyMoments.push({ timestamp: e.timestamp, description: m.description, nodesInvolved: m.nodes });
      }
    }

    const chain = await ledger.verifyChain();
    const consensusOrderValid =
      chain.ok && verifyMissionEventsAgainstGlobalChain(ledger.toArray(), ordered);

    const discoveredIds = new Set<string>();
    for (const e of ordered) {
      if (e.eventType === "target_discovered") {
        const id = String(e.payload.targetId ?? "");
        if (id) discoveredIds.add(id);
      }
    }
    const finalMapConsistent =
      discoveredIds.size === 0 || discoveredIds.size === Object.keys(finalState.targets).length;

    let incremental = buildPrefixState(ordered, missionId, 0);
    for (const e of ordered) incremental = applyMissionLedgerEvent(incremental, e);
    const bulkReplay = replayMissionFromLedger(ledger.toArray(), missionId);
    const deterministic = fingerprintState(incremental) === fingerprintState(bulkReplay);

    const finalStateFingerprint = fingerprintState(finalState);

    const summaryParts = [
      `${steps.length} step(s) in window`,
      `${ordered.length} total mission events`,
      `phase: ${finalState.phase}`,
      deterministic ? "replay matches full fold" : "replay drift vs full fold",
    ];

    return {
      missionId,
      totalEvents: steps.length,
      phaseHistory,
      keyMoments,
      verification: {
        deterministic,
        consensusOrderValid,
        finalMapConsistent,
      },
      operatorSummary: summaryParts.join(" · "),
      finalStateFingerprint,
    };
  }
}
