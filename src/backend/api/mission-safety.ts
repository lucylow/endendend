import type { MissionPolicy } from "@/backend/shared/mission-policy";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import { EventLogger } from "@/backend/observability/event-logger";
import { SafetyEngine, type SafetyState, type SafetyTelemetry } from "@/backend/safety/safety-engine";

/** Factory for the Vertex-ordered + Lattice-scored safety path used by mission controllers. */
export function createSafetyEngine(ledger: MissionLedger, registry: NodeRegistry, policy: MissionPolicy): SafetyEngine {
  return new SafetyEngine(ledger, registry, policy);
}

/**
 * Telemetry ingress: assess locally, then commit warnings / criticals to the Vertex plane
 * and apply Lattice trust deltas when an alert fires.
 */
export async function processMissionTelemetry(
  engine: SafetyEngine,
  missionId: string,
  nodeId: string,
  telemetry: SafetyTelemetry,
  nowMs: number,
): Promise<SafetyState | null> {
  const alert = engine.assessTelemetry(nodeId, telemetry);
  if (!alert) return null;
  const state = await engine.escalate(missionId, alert, nowMs);
  EventLogger.safetyEscalation(alert, missionId);
  return state;
}
