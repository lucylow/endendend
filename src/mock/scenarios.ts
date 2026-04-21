import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { MissionPhaseSim } from "./types";

export const PHASE_ORDER: MissionPhaseSim[] = [
  "init",
  "discovery",
  "search",
  "triage",
  "rescue",
  "extraction",
  "return",
  "complete",
];

export function nominalNextSimPhase(p: MissionPhaseSim): MissionPhaseSim | null {
  const i = PHASE_ORDER.indexOf(p);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1] ?? null;
}

export const SCENARIO_LABELS: Record<MissionScenarioKind, string> = {
  collapsed_building: "Collapsed building",
  tunnel: "Cave / tunnel",
  flood_rescue: "Flood rescue",
  wildfire: "Wildfire",
  hazmat: "Industrial hazmat",
  extraction: "Triage / extraction",
};

/** FoxMQ-style topics used for mesh / mission sync visualization. */
export function defaultTopicBundle(missionId: string): string[] {
  return [
    `foxmq/${missionId}/telemetry`,
    `foxmq/${missionId}/map_delta`,
    `foxmq/${missionId}/tasks`,
    `foxmq/${missionId}/mesh/heartbeat`,
    `foxmq/${missionId}/settlement/preview`,
  ];
}
