import { coerceMissionScenarioKind, type MissionScenarioKind } from "./mission-scenarios";

export type PolicyRoleType = "explorer" | "relay" | "triage" | "extractor" | "transport";

export interface MissionPolicy {
  scenario: MissionScenarioKind;
  roles: Array<{
    type: PolicyRoleType;
    minCount: number;
    prioritySensors: string[];
    maxRisk: number;
  }>;
  search: {
    density: number;
    maxDepth: number;
    geofenceRadius: number;
  };
  safety: {
    batteryThreshold: number;
    maxViolations: number;
    emergencyEscalation: string[];
  };
  tasks: {
    mix: Record<string, number>;
    confirmationThreshold: number;
  };
  latticeBudget: {
    minNodes: number;
    requiredCapabilities: string[];
  };
}

const TEMPLATES: Record<MissionScenarioKind, MissionPolicy> = {
  collapsed_building: {
    scenario: "collapsed_building",
    roles: [
      { type: "explorer", minCount: 2, prioritySensors: ["thermal", "audio"], maxRisk: 0.3 },
      { type: "relay", minCount: 1, prioritySensors: ["indoor"], maxRisk: 0.2 },
      { type: "triage", minCount: 1, prioritySensors: ["optical"], maxRisk: 0.4 },
      { type: "extractor", minCount: 1, prioritySensors: ["transport"], maxRisk: 0.5 },
    ],
    search: { density: 0.8, maxDepth: 50, geofenceRadius: 20 },
    safety: { batteryThreshold: 0.4, maxViolations: 2, emergencyEscalation: ["geo_fence_violation"] },
    tasks: { mix: { explore: 0.5, relay: 0.3, triage: 0.15, extract: 0.05 }, confirmationThreshold: 0.8 },
    latticeBudget: { minNodes: 5, requiredCapabilities: ["indoor", "thermal"] },
  },
  flood_rescue: {
    scenario: "flood_rescue",
    roles: [
      { type: "explorer", minCount: 2, prioritySensors: ["optical"], maxRisk: 0.5 },
      { type: "relay", minCount: 1, prioritySensors: [], maxRisk: 0.3 },
      { type: "transport", minCount: 1, prioritySensors: ["waterproof"], maxRisk: 0.6 },
      { type: "extractor", minCount: 2, prioritySensors: ["high_clearance"], maxRisk: 0.7 },
    ],
    search: { density: 0.6, maxDepth: 200, geofenceRadius: 50 },
    safety: { batteryThreshold: 0.5, maxViolations: 1, emergencyEscalation: ["water_level_rising"] },
    tasks: { mix: { explore: 0.4, transport: 0.4, extract: 0.2 }, confirmationThreshold: 0.7 },
    latticeBudget: { minNodes: 6, requiredCapabilities: ["waterproof", "transport"] },
  },
  hazmat: {
    scenario: "hazmat",
    roles: [
      { type: "explorer", minCount: 1, prioritySensors: ["gas", "thermal"], maxRisk: 0.1 },
      { type: "relay", minCount: 2, prioritySensors: ["sealed"], maxRisk: 0.05 },
      { type: "triage", minCount: 1, prioritySensors: ["gas"], maxRisk: 0.2 },
    ],
    search: { density: 1.2, maxDepth: 30, geofenceRadius: 10 },
    safety: { batteryThreshold: 0.6, maxViolations: 0, emergencyEscalation: ["gas_detected"] },
    tasks: { mix: { relay: 0.5, triage: 0.3, explore: 0.2 }, confirmationThreshold: 0.95 },
    latticeBudget: { minNodes: 4, requiredCapabilities: ["gas", "sealed"] },
  },
  tunnel: {
    scenario: "tunnel",
    roles: [
      { type: "explorer", minCount: 2, prioritySensors: ["lidar", "indoor"], maxRisk: 0.35 },
      { type: "relay", minCount: 2, prioritySensors: ["long_range_radio"], maxRisk: 0.25 },
      { type: "triage", minCount: 0, prioritySensors: ["optical"], maxRisk: 0.3 },
    ],
    search: { density: 0.9, maxDepth: 800, geofenceRadius: 15 },
    safety: { batteryThreshold: 0.35, maxViolations: 2, emergencyEscalation: ["comm_loss", "geo_fence_violation"] },
    tasks: { mix: { explore: 0.45, relay: 0.4, triage: 0.15 }, confirmationThreshold: 0.85 },
    latticeBudget: { minNodes: 4, requiredCapabilities: ["relay"] },
  },
  wildfire: {
    scenario: "wildfire",
    roles: [
      { type: "explorer", minCount: 2, prioritySensors: ["thermal", "rgb"], maxRisk: 0.45 },
      { type: "relay", minCount: 1, prioritySensors: ["long_range_radio"], maxRisk: 0.35 },
      { type: "triage", minCount: 1, prioritySensors: ["optical"], maxRisk: 0.4 },
    ],
    search: { density: 0.5, maxDepth: 120, geofenceRadius: 80 },
    safety: { batteryThreshold: 0.45, maxViolations: 1, emergencyEscalation: ["wind_shift", "thermal_runaway"] },
    tasks: { mix: { explore: 0.55, relay: 0.25, triage: 0.2 }, confirmationThreshold: 0.75 },
    latticeBudget: { minNodes: 4, requiredCapabilities: ["thermal"] },
  },
  extraction: {
    scenario: "extraction",
    roles: [
      { type: "explorer", minCount: 1, prioritySensors: ["optical"], maxRisk: 0.35 },
      { type: "relay", minCount: 1, prioritySensors: [], maxRisk: 0.3 },
      { type: "extractor", minCount: 2, prioritySensors: ["winch", "carrier"], maxRisk: 0.45 },
      { type: "transport", minCount: 0, prioritySensors: ["carrier"], maxRisk: 0.4 },
    ],
    search: { density: 0.55, maxDepth: 40, geofenceRadius: 25 },
    safety: { batteryThreshold: 0.35, maxViolations: 2, emergencyEscalation: ["load_unstable"] },
    tasks: { mix: { extract: 0.55, explore: 0.25, relay: 0.2 }, confirmationThreshold: 0.82 },
    latticeBudget: { minNodes: 3, requiredCapabilities: [] },
  },
};

export class ScenarioCompiler {
  compile(scenario: string): MissionPolicy {
    const key = coerceMissionScenarioKind(scenario);
    if (!key) {
      throw new Error(`Unknown scenario: ${scenario}`);
    }
    return TEMPLATES[key];
  }

  tryCompile(scenario: string | undefined | null): MissionPolicy | undefined {
    const key = coerceMissionScenarioKind(scenario);
    return key ? TEMPLATES[key] : undefined;
  }
}
