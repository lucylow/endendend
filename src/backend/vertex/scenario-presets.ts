import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { SwarmRuntimeConfig } from "./swarm-types";

export type ScenarioPreset = {
  id: MissionScenarioKind;
  label: string;
  sensorEmphasis: string[];
  commExpectation: "dense" | "mixed" | "sparse";
  risk01: number;
  recoveryThreshold01: number;
  taskBias: string[];
  mapBehavior: string;
};

export const VERTEX_SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "indoor_search",
    label: "Indoor search",
    sensorEmphasis: ["lidar", "imu", "optical"],
    commExpectation: "sparse",
    risk01: 0.35,
    recoveryThreshold01: 0.55,
    taskBias: ["mapping", "room_clear"],
    mapBehavior: "incremental_slam",
  },
  {
    id: "collapsed_building",
    label: "Collapsed building",
    sensorEmphasis: ["thermal", "audio", "gas"],
    commExpectation: "mixed",
    risk01: 0.4,
    recoveryThreshold01: 0.5,
    taskBias: ["victim_pin", "shoring"],
    mapBehavior: "unstable_debris",
  },
  {
    id: "tunnel",
    label: "Tunnel / cave",
    sensorEmphasis: ["lidar", "imu"],
    commExpectation: "sparse",
    risk01: 0.38,
    recoveryThreshold01: 0.52,
    taskBias: ["relay_extension", "mapping"],
    mapBehavior: "low_gps",
  },
  {
    id: "flood_rescue",
    label: "Flood rescue",
    sensorEmphasis: ["optical", "thermal"],
    commExpectation: "mixed",
    risk01: 0.45,
    recoveryThreshold01: 0.48,
    taskBias: ["boat_extract", "high_water_mark"],
    mapBehavior: "fluid_boundary",
  },
  {
    id: "wildfire",
    label: "Wildfire perimeter",
    sensorEmphasis: ["thermal", "optical"],
    commExpectation: "dense",
    risk01: 0.48,
    recoveryThreshold01: 0.42,
    taskBias: ["perimeter_scan", "ember_watch"],
    mapBehavior: "wind_bias_grid",
  },
  {
    id: "hazmat",
    label: "Hazmat",
    sensorEmphasis: ["gas", "thermal"],
    commExpectation: "mixed",
    risk01: 0.55,
    recoveryThreshold01: 0.6,
    taskBias: ["plume_edge", "sensor_drop"],
    mapBehavior: "contamination_gradient",
  },
  {
    id: "perimeter_sweep",
    label: "Perimeter sweep",
    sensorEmphasis: ["optical", "rf_spectrum"],
    commExpectation: "dense",
    risk01: 0.32,
    recoveryThreshold01: 0.45,
    taskBias: ["relay_extension", "boundary_ping"],
    mapBehavior: "ring_expand",
  },
  {
    id: "triage_operation",
    label: "Triage operation",
    sensorEmphasis: ["thermal", "audio"],
    commExpectation: "mixed",
    risk01: 0.36,
    recoveryThreshold01: 0.5,
    taskBias: ["triage_station", "victim_pin"],
    mapBehavior: "sector_priority",
  },
  {
    id: "night_mission",
    label: "Night mission",
    sensorEmphasis: ["thermal", "low_light_optical"],
    commExpectation: "sparse",
    risk01: 0.41,
    recoveryThreshold01: 0.53,
    taskBias: ["slow_search", "relay_extension"],
    mapBehavior: "low_visibility",
  },
  {
    id: "extraction",
    label: "Extraction focus",
    sensorEmphasis: ["payload", "optical"],
    commExpectation: "mixed",
    risk01: 0.37,
    recoveryThreshold01: 0.48,
    taskBias: ["extraction_prep", "lz_secure"],
    mapBehavior: "lz_centric",
  },
];

export function presetForScenario(scenario: MissionScenarioKind): ScenarioPreset {
  return VERTEX_SCENARIO_PRESETS.find((p) => p.id === scenario) ?? VERTEX_SCENARIO_PRESETS[0];
}

export function defaultRuntimeConfig(scenario: MissionScenarioKind, seed = 42): SwarmRuntimeConfig {
  return {
    scenario,
    seed,
    tickMs: 500,
    staleHeartbeatMs: 8000,
    operatorNodeId: "agent-cmd-e",
  };
}
