import { VERTEX_SCENARIO_PRESETS, defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { SwarmRuntimeConfig } from "@/backend/vertex/swarm-types";

export { VERTEX_SCENARIO_PRESETS };

export function scenarioRuntimeConfig(id: MissionScenarioKind, seed: number): SwarmRuntimeConfig {
  return defaultRuntimeConfig(id, seed);
}

export const SCENARIO_IDS: MissionScenarioKind[] = VERTEX_SCENARIO_PRESETS.map((p) => p.id);
