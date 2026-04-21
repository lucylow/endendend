import { applyVendorToCapabilities, VENDOR_PROFILES } from "./vendor-profiles";
import type { AgentCapabilityProfile, AutonomyPolicyKind, MobilityClass, SwarmAgentNode } from "./swarm-types";
import type { MissionNodeRole } from "@/backend/shared/mission-state";

function cap(partial: Partial<AgentCapabilityProfile>): AgentCapabilityProfile {
  const base: AgentCapabilityProfile = {
    sensors: [],
    maxPayloadKg: 5,
    maxAltitudeM: 120,
    maxSpeedMps: 12,
    enduranceMin: 35,
    meshRangeM: 600,
    indoorScore: 0.5,
    outdoorScore: 0.5,
    gpsImuConfidence: 0.75,
    thermalScore: 0.2,
    lidarScore: 0.2,
    lowLightScore: 0.3,
    gripperScore: 0.1,
    computeTier: 0.5,
    batteryDrainPerTick: 0.0012,
    recoveryLatencyMs: 900,
  };
  return { ...base, ...partial };
}

export type BaselineAgentDef = {
  nodeId: string;
  displayName: string;
  vendorKey: keyof typeof VENDOR_PROFILES;
  model: string;
  role: MissionNodeRole;
  mobility: MobilityClass;
  autonomyPolicy: AutonomyPolicyKind;
  capabilitySeed: Partial<AgentCapabilityProfile>;
};

/** Five-agent heterogeneous baseline: scout, relay, indoor, rescue, coordinator. */
export const VERTEX_BASELINE_FIVE: BaselineAgentDef[] = [
  {
    nodeId: "agent-scout-a",
    displayName: "Scout A (thermal)",
    vendorKey: "aero_nordic",
    model: "AN-Scout Mk4",
    role: "explorer",
    mobility: "multirotor",
    autonomyPolicy: "scout_continue",
    capabilitySeed: {
      sensors: ["thermal", "camera", "optical"],
      thermalScore: 0.95,
      outdoorScore: 0.92,
      maxAltitudeM: 140,
      maxSpeedMps: 14,
      meshRangeM: 650,
    },
  },
  {
    nodeId: "agent-relay-b",
    displayName: "Relay B (mesh)",
    vendorKey: "meshworks",
    model: "MW-Relay X2",
    role: "relay",
    mobility: "multirotor",
    autonomyPolicy: "relay_maintain",
    capabilitySeed: {
      sensors: ["optical", "rf_spectrum"],
      meshRangeM: 1200,
      computeTier: 0.55,
      outdoorScore: 0.85,
    },
  },
  {
    nodeId: "agent-indoor-c",
    displayName: "Indoor C (LIDAR)",
    vendorKey: "subterra",
    model: "ST-UGV-7",
    role: "explorer",
    mobility: "ground",
    autonomyPolicy: "map_indoor",
    capabilitySeed: {
      sensors: ["lidar", "imu", "optical"],
      lidarScore: 0.95,
      indoorScore: 0.95,
      maxAltitudeM: 3,
      maxSpeedMps: 2.2,
      gpsImuConfidence: 0.4,
    },
  },
  {
    nodeId: "agent-rescue-d",
    displayName: "Rescue D (gripper)",
    vendorKey: "heavylift",
    model: "HL-Rescue 9",
    role: "carrier",
    mobility: "ground",
    autonomyPolicy: "rescue_continue",
    capabilitySeed: {
      sensors: ["camera", "force_torque"],
      maxPayloadKg: 40,
      gripperScore: 0.92,
      indoorScore: 0.65,
      outdoorScore: 0.7,
    },
  },
  {
    nodeId: "agent-cmd-e",
    displayName: "Command E",
    vendorKey: "cogniflight",
    model: "CF-EdgeCommand",
    role: "observer",
    mobility: "multirotor",
    autonomyPolicy: "coordinator_queue",
    capabilitySeed: {
      sensors: ["camera", "rf_spectrum", "imu"],
      computeTier: 0.98,
      meshRangeM: 750,
      outdoorScore: 0.88,
    },
  },
];

export function buildSwarmAgent(def: BaselineAgentDef, trust01 = 0.92): SwarmAgentNode {
  const vendor = VENDOR_PROFILES[def.vendorKey];
  const capabilities = applyVendorToCapabilities(cap(def.capabilitySeed), vendor);
  return {
    nodeId: def.nodeId,
    displayName: def.displayName,
    vendorId: vendor.id,
    model: def.model,
    role: def.role,
    mobility: def.mobility,
    capabilities,
    position: { x: 0, y: 0, z: 0 },
    trust01,
    autonomyPolicy: def.autonomyPolicy,
  };
}

export function createBaselineSwarmNodeList(count = 5, trust01 = 0.92): SwarmAgentNode[] {
  const need = Math.max(5, count);
  const nodes: SwarmAgentNode[] = VERTEX_BASELINE_FIVE.map((d) => buildSwarmAgent(d, trust01));
  for (let i = 5; i < need; i++) {
    nodes.push(
      buildSwarmAgent(
        {
          nodeId: `agent-backup-${i}`,
          displayName: `Backup relay ${i}`,
          vendorKey: "meshworks",
          model: "MW-Relay Lite",
          role: "relay",
          mobility: "multirotor",
          autonomyPolicy: "relay_maintain",
          capabilitySeed: { sensors: ["optical"], meshRangeM: 900 },
        },
        trust01 - 0.02 * (i - 4),
      ),
    );
  }
  return nodes;
}
