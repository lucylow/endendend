import type { SwarmAgentNode, SimTelemetrySample } from "@/backend/vertex/swarm-types";
import type { LocalAutonomyDirective } from "@/backend/vertex/fallback-coordinator";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import type { PeerReachability } from "./networkModel";

export type NormalizedPeer = {
  peerId: string;
  displayName: string;
  nodeTypeLabel: string;
  vendorFamily: string;
  model: string;
  role: string;
  mobility: string;
  autonomyPolicy: string;
  trust01: number;
  battery01: number;
  linkQuality01: number;
  localAutonomy: string;
  rangeOrEndurance: string;
  indoorOutdoor: string;
  currentTaskId?: string;
  lastHeartbeatMs?: number;
  stale: boolean;
  offline: boolean;
  partitionReachableToOperator: boolean;
  relayAssistPeer?: string;
  queueDepth: number;
  recoveryState: string;
  sensors: string[];
  raw: SwarmAgentNode;
};

function nodeTypeLabel(n: SwarmAgentNode): string {
  if (n.role === "relay") return "relay_drone";
  if (n.autonomyPolicy === "map_indoor") return "indoor_robot";
  if (n.role === "carrier" && n.capabilities.gripperScore > 0.75) return "rescue_robot";
  if (n.role === "observer") return "command_capable_node";
  if (n.autonomyPolicy === "scout_continue") return "scout_drone";
  if (n.role === "medic") return "triage_node";
  if (n.autonomyPolicy === "relay_maintain" && n.capabilities.computeTier < 0.45) return "standby_relay";
  if (n.capabilities.maxPayloadKg >= 25) return "transport_capable_node";
  if (n.capabilities.thermalScore > 0.85 || n.capabilities.lidarScore > 0.85) return "sensor_focused_node";
  return "general_node";
}

function recoveryLabel(mode: VertexConnectivityMode, reach?: PeerReachability): string {
  if (reach?.operatorReachable === false) return "partition_local";
  if (mode === "recovery") return "merging_deltas";
  if (mode === "resync") return "resync";
  if (mode === "blackout" || mode === "partial_partition") return "degraded_mesh";
  return "nominal";
}

export function derivePeerProfile(
  n: SwarmAgentNode,
  tel: SimTelemetrySample | undefined,
  aut: LocalAutonomyDirective | undefined,
  reach: PeerReachability | undefined,
  connectivityMode: VertexConnectivityMode,
): NormalizedPeer {
  const battery01 = tel?.battery01 ?? 0.75;
  const link01 = tel?.link01 ?? reach?.meshBackbone01 ?? 0.35;
  const stale = tel ? tel.duplicate || tel.link01 < 0.11 : false;
  const indoorOutdoor =
    n.capabilities.indoorScore > n.capabilities.outdoorScore + 0.12
      ? "indoor_biased"
      : n.capabilities.outdoorScore > n.capabilities.indoorScore + 0.12
        ? "outdoor_biased"
        : "mixed";
  return {
    peerId: n.nodeId,
    displayName: n.displayName,
    nodeTypeLabel: nodeTypeLabel(n),
    vendorFamily: n.vendorId,
    model: n.model,
    role: n.role,
    mobility: n.mobility,
    autonomyPolicy: n.autonomyPolicy,
    trust01: n.trust01,
    battery01,
    linkQuality01: link01,
    localAutonomy: aut ? `${aut.policy}:${aut.action}` : "mesh_coordinated",
    rangeOrEndurance: `${Math.round(n.capabilities.meshRangeM)}m mesh · ${n.capabilities.enduranceMin}m endurance`,
    indoorOutdoor,
    currentTaskId: n.currentTaskId,
    lastHeartbeatMs: n.lastHeartbeatMs ?? tel?.receivedAtMs,
    stale,
    offline: Boolean(n.offline),
    partitionReachableToOperator: reach?.operatorReachable ?? false,
    relayAssistPeer: reach?.relayPeer,
    queueDepth: tel?.queueDepth ?? 0,
    recoveryState: recoveryLabel(connectivityMode, reach),
    sensors: [...(n.capabilities.sensors ?? [])],
    raw: n,
  };
}
