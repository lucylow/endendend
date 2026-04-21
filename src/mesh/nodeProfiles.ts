import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { MeshNodeArchetype, MeshPeerRichProfile } from "./types";

const ARCHETYPE_BY_ROLE: Partial<Record<string, MeshNodeArchetype>> = {
  explorer: "scout_drone",
  relay: "relay_drone",
  medic: "rescue_robot",
  carrier: "transport_node",
  observer: "backup_coordinator",
};

function inferArchetype(n: SwarmAgentNode, index: number): MeshNodeArchetype {
  const fromRole = ARCHETYPE_BY_ROLE[n.role];
  if (fromRole) return fromRole;
  if (n.mobility === "ground" && n.capabilities.indoorScore > 0.75) return "indoor_robot";
  if (n.capabilities.meshRangeM > 950) return "relay_drone";
  if (n.capabilities.sensors.length <= 2 && n.capabilities.computeTier < 0.45) return "sensor_node";
  if (n.capabilities.maxPayloadKg > 25) return "transport_node";
  const cycle: MeshNodeArchetype[] = [
    "standby_node",
    "sensor_node",
    "scout_drone",
    "backup_coordinator",
    "relay_drone",
    "indoor_robot",
    "rescue_robot",
    "transport_node",
  ];
  return cycle[index % cycle.length]!;
}

export function buildRichProfile(n: SwarmAgentNode, index: number, nowMs: number, partitionClusterId: string): MeshPeerRichProfile {
  const archetype = inferArchetype(n, index);
  const range = n.capabilities.meshRangeM * (0.92 + (index % 5) * 0.02);
  const relaySuit =
    archetype === "relay_drone"
      ? 0.92
      : archetype === "backup_coordinator"
        ? 0.78
        : archetype === "sensor_node"
          ? 0.35
          : archetype === "scout_drone"
            ? 0.55
            : archetype === "transport_node"
              ? 0.48
              : 0.5 + n.capabilities.outdoorScore * 0.2;

  const lossSens = archetype === "sensor_node" ? 0.85 : archetype === "relay_drone" ? 0.25 : 0.45 + (1 - n.trust01) * 0.3;
  const latSens = archetype === "indoor_robot" ? 0.7 : archetype === "scout_drone" ? 0.4 : 0.5;

  let connectivityState: MeshPeerRichProfile["connectivityState"] = "linked";
  if (n.offline) connectivityState = "offline";
  else if (n.healthStatus === "degraded") connectivityState = "degraded";

  return {
    nodeId: n.nodeId,
    displayName: n.displayName,
    vendorOrFamily: `${n.vendorId} · ${n.model}`,
    roleLabel: n.role,
    archetype,
    communicationRangeM: range,
    antennaGain01: Math.min(1, 0.55 + n.capabilities.outdoorScore * 0.35 + (archetype === "relay_drone" ? 0.12 : 0)),
    battery01: 0.75,
    trust01: n.trust01,
    reliability01: Math.min(1, 0.5 + n.trust01 * 0.45 + (archetype === "relay_drone" ? 0.08 : 0)),
    packetLossSensitivity01: lossSens,
    latencySensitivity01: latSens,
    relaySuitability01: relaySuit,
    autonomyLevel01:
      n.autonomyPolicy === "coordinator_queue"
        ? 0.35
        : n.autonomyPolicy === "relay_maintain"
          ? 0.55
          : n.autonomyPolicy === "scout_continue"
            ? 0.82
            : 0.72,
    sensorStack: [...n.capabilities.sensors],
    position: { ...n.position },
    connectivityState,
    lastHeartbeatMs: n.lastHeartbeatMs ?? nowMs,
    partitionClusterId,
    localQueueDepth: 0,
    recoveryReadiness01: n.offline ? 0 : Math.max(0.08, 1 - Math.min(1, n.capabilities.recoveryLatencyMs / 4500)),
  };
}

export function clusterIdForNode(nodeId: string, clusters: string[][]): string {
  for (let i = 0; i < clusters.length; i++) {
    if (clusters[i]?.includes(nodeId)) return `p${i}`;
  }
  return "p0";
}

export function updateProfileRuntime(
  p: MeshPeerRichProfile,
  patch: Partial<Pick<MeshPeerRichProfile, "battery01" | "localQueueDepth" | "connectivityState" | "lastHeartbeatMs" | "partitionClusterId">>,
): MeshPeerRichProfile {
  return { ...p, ...patch };
}
