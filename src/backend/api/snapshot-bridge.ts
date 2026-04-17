import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";

/**
 * Optional slice merged into ``SwarmBackendSnapshot.tashi.sar`` for dashboards.
 * Python mesh may omit this entirely — Lovable / Vite builds stay compatible.
 */
export function sarProjectionFromEnvelope(env: TashiStateEnvelope): {
  missionPhase: string;
  ledgerHead: string;
  vertexSequence: number;
  latticeOnline: number;
} {
  return {
    missionPhase: env.mission.phase,
    ledgerHead: env.vertex.lastCommittedHash,
    vertexSequence: env.vertex.sequence,
    latticeOnline: env.lattice.onlineNodeIds.length,
  };
}
