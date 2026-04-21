import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";

/** Scenario-facing tuning for the sensor engine (weights 0–1). */
export type ScenarioSensorProfile = {
  scenario: MissionScenarioKind;
  label: string;
  narrative: string;
  /** Which sensors matter most for UI emphasis / scoring. */
  emphasis: Partial<
    Record<
      | "gps"
      | "imu"
      | "thermal"
      | "optical"
      | "ir"
      | "lidar"
      | "audio"
      | "gas"
      | "smoke"
      | "moisture"
      | "link"
      | "battery",
      number
    >
  >;
  gpsBaseline: number;
  gpsLossRate: number;
  indoorDriftPerTick: number;
  thermalNoise: number;
  imuSpikeProb: number;
  linkVolatility: number;
  relayStressMultiplier: number;
  moistureBias: number;
  gasSensitivity: number;
  smokeSensitivity: number;
  nightOpticalPenalty: number;
  hazardGeofenceTightness: number;
};

export const SENSOR_PROFILES: Record<MissionScenarioKind, ScenarioSensorProfile> = {
  collapsed_building: {
    scenario: "collapsed_building",
    label: "Collapsed structure",
    narrative: "Dust, debris attenuation, poor sky view; thermal hints for victims; relay chains critical.",
    emphasis: { imu: 0.85, thermal: 0.9, lidar: 0.75, link: 0.95, optical: 0.6, gps: 0.25 },
    gpsBaseline: 0.22,
    gpsLossRate: 0.45,
    indoorDriftPerTick: 0.012,
    thermalNoise: 1.6,
    imuSpikeProb: 0.08,
    linkVolatility: 0.14,
    relayStressMultiplier: 1.35,
    moistureBias: 0.05,
    gasSensitivity: 0.4,
    smokeSensitivity: 0.55,
    nightOpticalPenalty: 0.15,
    hazardGeofenceTightness: 0.35,
  },
  tunnel: {
    scenario: "tunnel",
    label: "Cave / tunnel mesh",
    narrative: "Near-zero GPS, relay-heavy topology, lidar + IMU navigation, narrowed effective range.",
    emphasis: { lidar: 0.95, imu: 0.9, audio: 0.55, link: 1, gps: 0.05, battery: 0.5 },
    gpsBaseline: 0.04,
    gpsLossRate: 0.85,
    indoorDriftPerTick: 0.018,
    thermalNoise: 0.9,
    imuSpikeProb: 0.05,
    linkVolatility: 0.1,
    relayStressMultiplier: 1.55,
    moistureBias: 0.2,
    gasSensitivity: 0.25,
    smokeSensitivity: 0.2,
    nightOpticalPenalty: 0.35,
    hazardGeofenceTightness: 0.25,
  },
  flood_rescue: {
    scenario: "flood_rescue",
    label: "Flood rescue",
    narrative: "Moisture exposure, moving hydraulic targets, higher relay drag, terrain-driven link fades.",
    emphasis: { moisture: 1, battery: 0.75, link: 0.85, optical: 0.55, gps: 0.55, imu: 0.45 },
    gpsBaseline: 0.48,
    gpsLossRate: 0.22,
    indoorDriftPerTick: 0.006,
    thermalNoise: 1.1,
    imuSpikeProb: 0.04,
    linkVolatility: 0.18,
    relayStressMultiplier: 1.25,
    moistureBias: 0.65,
    gasSensitivity: 0.2,
    smokeSensitivity: 0.15,
    nightOpticalPenalty: 0.12,
    hazardGeofenceTightness: 0.4,
  },
  wildfire: {
    scenario: "wildfire",
    label: "Wildfire corridor",
    narrative: "Heat gradients, smoke-driven link fades, IR/thermal dominate; corridors shift quickly.",
    emphasis: { thermal: 1, smoke: 0.85, ir: 0.9, link: 0.9, optical: 0.35, gps: 0.5 },
    gpsBaseline: 0.42,
    gpsLossRate: 0.28,
    indoorDriftPerTick: 0.004,
    thermalNoise: 2.4,
    imuSpikeProb: 0.03,
    linkVolatility: 0.22,
    relayStressMultiplier: 1.2,
    moistureBias: 0.08,
    gasSensitivity: 0.35,
    smokeSensitivity: 0.95,
    nightOpticalPenalty: 0.08,
    hazardGeofenceTightness: 0.55,
  },
  hazmat: {
    scenario: "hazmat",
    label: "Industrial hazmat",
    narrative: "Gas confirmation loops, strict geofence, safety-stop gating, trust-weighted routing.",
    emphasis: { gas: 1, thermal: 0.65, link: 0.7, gps: 0.55, optical: 0.4 },
    gpsBaseline: 0.52,
    gpsLossRate: 0.12,
    indoorDriftPerTick: 0.005,
    thermalNoise: 0.8,
    imuSpikeProb: 0.02,
    linkVolatility: 0.08,
    relayStressMultiplier: 1.05,
    moistureBias: 0.1,
    gasSensitivity: 1,
    smokeSensitivity: 0.45,
    nightOpticalPenalty: 0.1,
    hazardGeofenceTightness: 0.92,
  },
  extraction: {
    scenario: "extraction",
    label: "Triage / extraction",
    narrative: "Vitals-like signals, multi-target evidence fusion, extraction readiness scoring.",
    emphasis: { optical: 0.7, audio: 0.65, thermal: 0.55, link: 0.65, battery: 0.5 },
    gpsBaseline: 0.55,
    gpsLossRate: 0.15,
    indoorDriftPerTick: 0.007,
    thermalNoise: 1,
    imuSpikeProb: 0.03,
    linkVolatility: 0.09,
    relayStressMultiplier: 1.1,
    moistureBias: 0.06,
    gasSensitivity: 0.25,
    smokeSensitivity: 0.2,
    nightOpticalPenalty: 0.18,
    hazardGeofenceTightness: 0.45,
  },
};

export function getSensorProfile(scenario: MissionScenarioKind): ScenarioSensorProfile {
  return SENSOR_PROFILES[scenario] ?? SENSOR_PROFILES.collapsed_building;
}
