import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { TERMINAL_PHASES } from "@/backend/shared/mission-phases";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { merkleRootHex, sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MissionLedger, MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

export type ProofContribution = {
  eventType: string;
  /** Vertex-ordered proof id (ledger event hash). */
  eventHash: string;
  /** Lattice trust in ``[0, 1]`` at settlement time (normalized from registry). */
  latticeScore: number;
  /** Latest ``recovery_checkpoint`` hash at or before this proof, else ``mission_created`` hash. */
  checkpointHash: string;
  /** Reward weight after trust weighting (HBAR-scale units for demo economics). */
  value: number;
};

export type RewardManifestRecord = {
  missionId: string;
  terminalPhase: "complete" | "aborted";
  totalPool: string;
  timestamp: number;
  nodeRewards: Array<{
    nodeId: string;
    contributions: ProofContribution[];
    totalEarned: string;
    reputationAtSettlement: number;
  }>;
  verification: {
    vertexLedgerTail: string;
    latticeValidationRoot: string;
    safetyEventsIncluded: number;
    merkleProofRoot: string;
  };
  arcSettlement: {
    chain: "hedera" | "ethereum" | "solana";
    txPayloadHash: string;
    expectedFinality: number;
  };
};

function baseRewardWeight(eventType: MissionLedgerEvent["eventType"], payload: Record<string, unknown>): number {
  switch (eventType) {
    case "target_discovered":
      return 10;
    case "target_confirmed":
      return 15;
    case "extraction_confirmed":
      return 50;
    case "safety_alert":
      return 20;
    case "recovery_checkpoint": {
      const label = String(payload.label ?? "").toLowerCase();
      return label.includes("relay") ? 5 : 6;
    }
    case "task_assigned":
      return 4;
    default:
      return 0;
  }
}

function checkpointHashBefore(events: MissionLedgerEvent[], atTs: number): string {
  const checkpoints = events.filter((e) => e.eventType === "recovery_checkpoint" && e.timestamp <= atTs);
  if (checkpoints.length) return checkpoints[checkpoints.length - 1].eventHash;
  const created = events.find((e) => e.eventType === "mission_created");
  return created?.eventHash ?? "genesis";
}

async function contributionMerkleRoot(rows: ProofContribution[]): Promise<string> {
  const leaves = await Promise.all(
    rows.map((c) =>
      sha256Hex(
        stableStringify({
          eventType: c.eventType,
          eventHash: c.eventHash,
          checkpointHash: c.checkpointHash,
          latticeScore: c.latticeScore,
          value: c.value,
        }),
      ),
    ),
  );
  return merkleRootHex(leaves.length ? leaves : [await sha256Hex("reward-manifest|empty")]);
}

/**
 * Settlement-ready economics manifest: each line cites a Vertex ``eventHash``, Lattice trust,
 * and checkpoint snapshot hash suitable for Arc public settlement copy.
 */
export async function buildRewardManifest(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  nowMs: number,
  capacityScenario: MissionScenarioKind = "collapsed_building",
): Promise<RewardManifestRecord> {
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  if (!TERMINAL_PHASES.has(mission.phase)) {
    throw new Error("Rewards only for terminal missions");
  }

  const events = ledger.eventsForMission(missionId);
  const safetyEventsIncluded = events.filter((e) => e.eventType === "safety_alert").length;

  const nodeRewards: Record<string, { contributions: ProofContribution[]; total: number }> = {};

  for (const event of events) {
    if (event.plane === "arc") continue;

    const base = baseRewardWeight(event.eventType, event.payload ?? {});
    if (base <= 0) continue;

    const nodeId = event.actorId;
    if (!nodeRewards[nodeId]) nodeRewards[nodeId] = { contributions: [], total: 0 };

    const trust01 = registry.latticeTrust01(nodeId);
    const weighted = base * trust01;
    const cp = checkpointHashBefore(events, event.timestamp);

    nodeRewards[nodeId].contributions.push({
      eventType: event.eventType,
      eventHash: event.eventHash,
      latticeScore: trust01,
      checkpointHash: cp,
      value: weighted,
    });
    nodeRewards[nodeId].total += weighted;
  }

  const flatContributions = Object.values(nodeRewards).flatMap((n) => n.contributions);
  const merkleProofRoot = await contributionMerkleRoot(flatContributions);

  const totalNumeric = Object.values(nodeRewards).reduce((sum, nr) => sum + nr.total, 0);
  const totalPool = `${totalNumeric.toFixed(4)} HBAR`;

  const latticeValidationRoot = await registry.validationRootForMission(missionId, nowMs, capacityScenario);

  const terminalPhase = mission.phase === "complete" ? "complete" : "aborted";
  const txPayloadHash = await sha256Hex(
    stableStringify({ missionId, totalPool, merkleProofRoot, latticeValidationRoot, terminalPhase }),
  );

  return {
    missionId,
    terminalPhase,
    totalPool,
    timestamp: nowMs,
    nodeRewards: Object.entries(nodeRewards)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nodeId, data]) => ({
        nodeId,
        contributions: data.contributions,
        totalEarned: `${data.total.toFixed(4)} HBAR`,
        reputationAtSettlement: registry.latticeTrust01(nodeId),
      })),
    verification: {
      vertexLedgerTail: ledger.missionTailHash(missionId),
      latticeValidationRoot,
      safetyEventsIncluded,
      merkleProofRoot,
    },
    arcSettlement: {
      chain: "hedera",
      txPayloadHash,
      expectedFinality: 3,
    },
  };
}
