import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { ScenarioMapProfile } from "./types";

const DEFAULTS: Omit<ScenarioMapProfile, "scenario"> = {
  frontierDensity01: 0.45,
  hazardRate01: 0.08,
  targetScatter01: 0.12,
  syncUrgency01: 0.5,
  offlineToleranceMs: 25_000,
  relayImportance01: 0.55,
  confidenceFloor01: 0.35,
};

const BY_SCENARIO: Partial<Record<MissionScenarioKind, Partial<Omit<ScenarioMapProfile, "scenario">>>> = {
  collapsed_building: { frontierDensity01: 0.55, hazardRate01: 0.12, relayImportance01: 0.62, syncUrgency01: 0.55 },
  tunnel: { frontierDensity01: 0.35, hazardRate01: 0.06, relayImportance01: 0.78, syncUrgency01: 0.42 },
  flood_rescue: { frontierDensity01: 0.5, hazardRate01: 0.15, syncUrgency01: 0.62 },
  wildfire: { frontierDensity01: 0.48, hazardRate01: 0.22, syncUrgency01: 0.7 },
  hazmat: { frontierDensity01: 0.4, hazardRate01: 0.28, syncUrgency01: 0.72, confidenceFloor01: 0.5 },
  indoor_search: { frontierDensity01: 0.58, hazardRate01: 0.05, syncUrgency01: 0.38 },
  perimeter_sweep: { frontierDensity01: 0.62, hazardRate01: 0.04, relayImportance01: 0.48 },
  triage_operation: { frontierDensity01: 0.52, targetScatter01: 0.22, syncUrgency01: 0.65 },
  night_mission: { frontierDensity01: 0.42, hazardRate01: 0.09, syncUrgency01: 0.48 },
  extraction: { frontierDensity01: 0.44, targetScatter01: 0.18, relayImportance01: 0.5 },
};

export function scenarioMapProfile(scenario: MissionScenarioKind): ScenarioMapProfile {
  const patch = BY_SCENARIO[scenario] ?? {};
  return { ...DEFAULTS, ...patch, scenario };
}
