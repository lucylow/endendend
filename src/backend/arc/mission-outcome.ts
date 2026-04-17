import { buildRewardManifest, type RewardManifestRecord } from "@/backend/arc/reward-manifest";
import { buildTashiStateEnvelope } from "@/backend/shared/build-envelope";
import { TERMINAL_PHASES } from "@/backend/shared/mission-phases";
import type { MissionState } from "@/backend/shared/mission-state";
import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import type { SafetyEngine } from "@/backend/safety/safety-engine";
import { MissionReplayer } from "@/backend/replay/mission-replayer";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import type { MissionLedger, MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

const TRUST_VIOLATION_THRESHOLD = 0.4;

export interface MissionOutcomePacket {
  missionId: string;
  terminalHash: string;
  checkpointHash: string;
  arcPayloadHash: string;

  executiveSummary: {
    scenario: string;
    durationMinutes: number;
    targetsFound: number;
    extractions: number;
    coveragePercent: number;
    safetyIncidents: number;
    totalRewardPool: string;
    status: "success" | "partial" | "failed";
  };

  ledgerProof: {
    eventCount: number;
    consensusEvents: number;
    tailEventType: string;
  };

  latticeValidation: {
    finalNodeCount: number;
    avgReputation: number;
    trustViolations: number;
  };

  contributions: Array<{
    nodeId: string;
    roleSummary: string;
    keyProofs: string[];
    rewardEarned: string;
  }>;

  settlementReady: boolean;
  chainTargets: Array<{
    chain: "hedera" | "ethereum";
    payloadSize: number;
    estimatedGas: number;
  }>;

  replayVerified: boolean;
  operatorNotes: string[];
}

function missionTailEvent(events: MissionLedgerEvent[]): MissionLedgerEvent {
  if (!events.length) throw new Error("mission_outcome_empty_ledger");
  return events[events.length - 1];
}

function countConsensusStyleEvents(events: MissionLedgerEvent[]): number {
  const milestone = new Set([
    "phase_transition",
    "target_discovered",
    "target_confirmed",
    "task_assigned",
    "extraction_confirmed",
    "recovery_checkpoint",
    "safety_alert",
  ]);
  return events.filter((e) => e.plane === "vertex" && milestone.has(e.eventType)).length;
}

function executiveStatus(phase: MissionState["phase"]): MissionOutcomePacket["executiveSummary"]["status"] {
  if (phase === "complete") return "success";
  if (phase === "aborted") return "partial";
  return "failed";
}

function chainTargetsFromRewardManifest(r: RewardManifestRecord): MissionOutcomePacket["chainTargets"] {
  const enc = new TextEncoder();
  const payload = stableStringify(r);
  const payloadSize = enc.encode(payload).length;
  return [
    {
      chain: "hedera" as const,
      payloadSize,
      estimatedGas: 120_000 + Math.min(800_000, payloadSize * 18),
    },
    {
      chain: "ethereum" as const,
      payloadSize,
      estimatedGas: 46_000 + Math.min(1_200_000, payloadSize * 24),
    },
  ];
}

async function missionCheckpointHash(envelope: TashiStateEnvelope): Promise<string> {
  const tail = envelope.ledgerTail;
  if (!tail) throw new Error("mission_outcome_missing_ledger_tail");
  return sha256Hex(
    stableStringify({
      missionId: envelope.mission.missionId,
      phase: envelope.mission.phase,
      ledgerTail: tail.eventHash,
      nodeCount: Object.keys(envelope.mission.roster).length,
      targetCount: Object.keys(envelope.mission.targets).length,
      mapCells: envelope.mission.mapSummary.cellsKnown,
      vertexSequence: envelope.mission.consensusPointer.sequence,
    }),
  );
}

export type BuildMissionOutcomeContext = {
  ledger: MissionLedger;
  registry: NodeRegistry;
  safety: SafetyEngine;
  missionId: string;
  nowMs: number;
};

/**
 * Arc-ready mission outcome: one object with judge-facing narrative plus hashes tied to Vertex tail,
 * Lattice trust, and (when terminal) reward economics.
 */
export async function buildMissionOutcomePacket(ctx: BuildMissionOutcomeContext): Promise<MissionOutcomePacket> {
  const { ledger, registry, safety, missionId, nowMs } = ctx;
  const missionEvents = ledger.eventsForMission(missionId);
  const tailEvent = missionTailEvent(missionEvents);
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  const envelope = buildTashiStateEnvelope(mission, ledger, registry, nowMs);
  const checkpointHash = await missionCheckpointHash(envelope);
  const scenario = mission.scenario ?? "collapsed_building";
  const safetySummary = safety.getSafetySummary(missionId);
  const swarm = envelope.swarmHealth ?? { onlineNodes: 0, avgReputation: 0, batteryCritical: 0 };

  const rosterIds = Object.keys(mission.roster);
  const trustViolations = rosterIds.filter((id) => registry.latticeTrust01(id) < TRUST_VIOLATION_THRESHOLD).length;

  const extractionCount = missionEvents.filter((e) => e.eventType === "extraction_confirmed").length;
  const targetsFound = Object.keys(mission.targets).length;
  const coveragePercent = envelope.mapOverview?.coveragePercent ?? 0;

  const terminal = TERMINAL_PHASES.has(mission.phase);
  let rewards: RewardManifestRecord | null = null;
  if (terminal) {
    rewards = await buildRewardManifest(ledger, registry, missionId, nowMs, scenario);
  }

  const chain = await ledger.verifyChain();
  const replayer = new MissionReplayer(ledger);
  const { report: replayReport } = await replayer.replayMission(missionId);
  const replayVerified =
    chain.ok && replayReport.verification.consensusOrderValid && replayReport.verification.deterministic;

  const durationMinutes = Math.max(0, (tailEvent.timestamp - mission.createdAtMs) / 60_000);

  const contributions =
    rewards?.nodeRewards.map((r) => {
      const role = mission.roster[r.nodeId]?.role ?? "participant";
      const head = r.contributions[0]?.eventType ?? "proof";
      return {
        nodeId: r.nodeId,
        roleSummary: `${role}: ${r.contributions.length} proof(s), last ${head}`,
        keyProofs: r.contributions.slice(-3).map((c) => c.eventHash),
        rewardEarned: r.totalEarned,
      };
    }) ?? [];

  const body: Omit<MissionOutcomePacket, "arcPayloadHash"> = {
    missionId,
    terminalHash: tailEvent.eventHash,
    checkpointHash,
    executiveSummary: {
      scenario,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
      targetsFound,
      extractions: extractionCount,
      coveragePercent,
      safetyIncidents: safetySummary.escalatedCount,
      totalRewardPool: rewards?.totalPool ?? "0.0000 HBAR",
      status: executiveStatus(mission.phase),
    },
    ledgerProof: {
      eventCount: missionEvents.length,
      consensusEvents: countConsensusStyleEvents(missionEvents),
      tailEventType: tailEvent.eventType,
    },
    latticeValidation: {
      finalNodeCount: rosterIds.length,
      avgReputation: Math.round(swarm.avgReputation * 1000) / 1000,
      trustViolations,
    },
    contributions,
    settlementReady: terminal,
    chainTargets: rewards ? chainTargetsFromRewardManifest(rewards) : [],
    replayVerified,
    operatorNotes: [
      `Mission ${missionId} ledger tail ${tailEvent.eventType} @ ${new Date(tailEvent.timestamp).toISOString()}`,
      `${rosterIds.length} roster nodes · ${missionEvents.length} mission-scoped events`,
      `${safetySummary.escalatedCount} safety ledger rows · replay ${replayVerified ? "ok" : "check"}`,
      rewards ? `${rewards.nodeRewards.length} nodes in reward manifest` : "Rewards pending terminal phase",
    ],
  };

  const arcPayloadHash = await sha256Hex(stableStringify(body));
  return { ...body, arcPayloadHash };
}

export class MissionOutcome {
  constructor(
    private readonly ledger: MissionLedger,
    private readonly registry: NodeRegistry,
    private readonly safety: SafetyEngine,
  ) {}

  generatePacket(missionId: string, nowMs: number = Date.now()): Promise<MissionOutcomePacket> {
    return buildMissionOutcomePacket({
      ledger: this.ledger,
      registry: this.registry,
      safety: this.safety,
      missionId,
      nowMs,
    });
  }
}
