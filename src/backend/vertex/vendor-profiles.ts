import type { AgentCapabilityProfile } from "./swarm-types";

export type VendorProfile = {
  id: string;
  label: string;
  commStackStrength: number;
  motorEnduranceFactor: number;
  defaultRecoveryLatencyMs: number;
  batteryCurveSteepness: number;
  traitTags: string[];
  patchCapabilities: Partial<AgentCapabilityProfile>;
};

/** Vendor/config differences that feed bid scoring and eligibility. */
export const VENDOR_PROFILES: Record<string, VendorProfile> = {
  aero_nordic: {
    id: "aero_nordic",
    label: "AeroNordic UAV",
    commStackStrength: 0.85,
    motorEnduranceFactor: 1.05,
    defaultRecoveryLatencyMs: 800,
    batteryCurveSteepness: 1,
    traitTags: ["cold_weather", "long_range"],
    patchCapabilities: { outdoorScore: 0.95, gpsImuConfidence: 0.9, meshRangeM: 900 },
  },
  meshworks: {
    id: "meshworks",
    label: "MeshWorks Relay",
    commStackStrength: 0.98,
    motorEnduranceFactor: 0.95,
    defaultRecoveryLatencyMs: 400,
    batteryCurveSteepness: 0.9,
    traitTags: ["mesh", "relay_grade"],
    patchCapabilities: { meshRangeM: 1400, computeTier: 0.6 },
  },
  subterra: {
    id: "subterra",
    label: "SubTerra Robotics",
    commStackStrength: 0.7,
    motorEnduranceFactor: 1.1,
    defaultRecoveryLatencyMs: 1200,
    batteryCurveSteepness: 0.85,
    traitTags: ["indoor", "lidar_first"],
    patchCapabilities: { indoorScore: 0.95, lidarScore: 0.95, gpsImuConfidence: 0.45 },
  },
  heavylift: {
    id: "heavylift",
    label: "HeavyLift Rescue",
    commStackStrength: 0.72,
    motorEnduranceFactor: 0.88,
    defaultRecoveryLatencyMs: 1500,
    batteryCurveSteepness: 1.15,
    traitTags: ["payload", "extraction"],
    patchCapabilities: { maxPayloadKg: 45, gripperScore: 0.95, maxAltitudeM: 80 },
  },
  cogniflight: {
    id: "cogniflight",
    label: "CogniFlight Command",
    commStackStrength: 0.88,
    motorEnduranceFactor: 0.92,
    defaultRecoveryLatencyMs: 600,
    batteryCurveSteepness: 1,
    traitTags: ["edge_compute", "coordination"],
    patchCapabilities: { computeTier: 0.98, meshRangeM: 700 },
  },
};

export function applyVendorToCapabilities(
  base: AgentCapabilityProfile,
  vendor: VendorProfile,
): AgentCapabilityProfile {
  const drainAdj = 0.08 * (vendor.batteryCurveSteepness - 1);
  return {
    ...base,
    ...vendor.patchCapabilities,
    meshRangeM: (base.meshRangeM ?? 0) * (0.85 + 0.15 * vendor.commStackStrength),
    enduranceMin: Math.round(base.enduranceMin * vendor.motorEnduranceFactor),
    batteryDrainPerTick: Math.max(0.0005, base.batteryDrainPerTick + drainAdj),
    recoveryLatencyMs: vendor.defaultRecoveryLatencyMs,
  };
}
