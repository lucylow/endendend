import type { MissionState } from "./mission-state";
import type { TashiStateEnvelope } from "./tashi-state-envelope";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";

export function buildTashiStateEnvelope(
  mission: MissionState,
  ledger: MissionLedger,
  registry: NodeRegistry,
  nowMs: number,
): TashiStateEnvelope {
  const head = ledger.head();
  return {
    mission,
    vertex: {
      lastCommittedHash: head?.eventHash ?? mission.consensusPointer.lastEventHash,
      sequence: mission.consensusPointer.sequence,
    },
    lattice: registry.exportSnapshot(nowMs),
  };
}
