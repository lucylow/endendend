import { latticePhaseReadiness, type MissionPhase } from "@/backend/shared/mission-phases";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { commitVertexBatch, suggestPhaseTransition } from "@/backend/vertex/consensus-gateway";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { buildTashiStateEnvelope } from "@/backend/shared/build-envelope";

export type MissionBootstrapResult = {
  ledger: MissionLedger;
  firstEventHash: string;
};

/** Seed append-only mission + reconstruct read model. */
export async function bootstrapMission(
  missionId: string,
  actorId: string,
  nowMs: number,
): Promise<MissionBootstrapResult> {
  const ledger = new MissionLedger();
  const first = await ledger.append({
    missionId,
    actorId,
    eventType: "mission_created",
    plane: "vertex",
    payload: { phase: "init", name: missionId },
    timestamp: nowMs,
    previousHash: ledger.tailHash(),
  });
  return { ledger, firstEventHash: first.eventHash };
}

export async function proposeAndCommitPhaseTransition(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  actorId: string,
  toPhase: MissionPhase,
  nowMs: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  const fromPhase: MissionPhase = mission.phase;
  const snap = registry.exportSnapshot(nowMs);
  const roster = mission.roster;
  const ctx = {
    peerCount: Math.max(Object.keys(roster).length, snap.onlineNodeIds.length),
    hasThermal: Object.values(roster).some((r) => r.capabilities.some((c) => c.toLowerCase().includes("thermal"))),
    hasRelay: Object.values(roster).some((r) => r.role === "relay" || r.capabilities.some((c) => c.toLowerCase().includes("relay"))),
    hasCarrier: Object.values(roster).some((r) => r.role === "carrier" || r.capabilities.some((c) => c.toLowerCase().includes("carrier"))),
  };
  const gate = latticePhaseReadiness(toPhase, ctx);
  if (!gate.ok) return { ok: false, reason: gate.reason ?? "lattice_gate" };

  const sug = suggestPhaseTransition(missionId, actorId, fromPhase, toPhase, nowMs);
  if ("error" in sug) return { ok: false, reason: sug.error };
  await commitVertexBatch(ledger, [sug]);
  return { ok: true };
}

export function missionEnvelopeView(ledger: MissionLedger, registry: NodeRegistry, missionId: string, nowMs: number) {
  const mission = replayMissionFromLedger(ledger.toArray(), missionId);
  return buildTashiStateEnvelope(mission, ledger, registry, nowMs);
}
