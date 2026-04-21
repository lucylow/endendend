import { SeededRandom } from "./seededRandom";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";

export type MapDelta = {
  at: number;
  exploredDelta: number;
  frontierHint: string;
  blockedAdded: number;
  targetHint?: string;
};

export function nextMapDelta(seed: string, scenario: MissionScenarioKind, phase: string, tick: number): MapDelta {
  const rng = new SeededRandom(`${seed}|map|${tick}`);
  const exploredDelta = 1 + rng.nextInt(0, scenario === "tunnel" ? 2 : 4);
  return {
    at: Date.now(),
    exploredDelta,
    frontierHint: phase === "discovery" ? "widening_search_ring" : "frontier_push",
    blockedAdded: rng.next() > 0.82 ? 1 : 0,
    targetHint: rng.next() > 0.88 ? "thermal_echo" : undefined,
  };
}
