import { MissionOutcome } from "@/backend/arc/mission-outcome";
import { createSafetyEngine } from "@/backend/api/mission-safety";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { ScenarioCompiler } from "@/backend/shared/mission-policy";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import { EventLogger, type ObservabilityLogRecord } from "@/backend/observability/event-logger";

const compiler = new ScenarioCompiler();

/**
 * Shape-only helper for an operator HTTP handler: returns buffered structured rows for ``missionId``.
 */
export function observabilityLogsForMission(missionId: string): ObservabilityLogRecord[] {
  return EventLogger.queryByMission(missionId);
}

/**
 * Builds a ``MissionOutcome`` with the same policy compiler used elsewhere in SAR flows.
 */
export async function missionOutcomePacketForLedger(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  nowMs: number,
) {
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  const scenario = mission.scenario ?? "collapsed_building";
  const policy = compiler.compile(scenario);
  const safety = createSafetyEngine(ledger, registry, policy);
  const outcome = new MissionOutcome(ledger, registry, safety);
  return outcome.generatePacket(missionId, nowMs);
}
