import type { SwarmAgentNode } from "./swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";

export type LocalAutonomyDirective = {
  nodeId: string;
  policy: string;
  action: string;
  safeOffline: boolean;
};

/** Policy-driven local behavior when consensus / operator link is delayed. */
export function localAutonomyDirectives(
  node: SwarmAgentNode,
  connectivityMode: VertexConnectivityMode,
  operatorReachable: boolean,
): LocalAutonomyDirective {
  const degraded = connectivityMode !== "normal" && connectivityMode !== "resync";
  if (!degraded && operatorReachable) {
    return { nodeId: node.nodeId, policy: node.autonomyPolicy, action: "follow_vertex_live", safeOffline: false };
  }
  switch (node.autonomyPolicy) {
    case "scout_continue":
      return {
        nodeId: node.nodeId,
        policy: node.autonomyPolicy,
        action: "scan_next_sector_local",
        safeOffline: true,
      };
    case "relay_maintain":
      return {
        nodeId: node.nodeId,
        policy: node.autonomyPolicy,
        action: "maintain_mesh_forwarding",
        safeOffline: true,
      };
    case "rescue_continue":
      return {
        nodeId: node.nodeId,
        policy: node.autonomyPolicy,
        action: "hold_last_extraction_vector",
        safeOffline: true,
      };
    case "map_indoor":
      return {
        nodeId: node.nodeId,
        policy: node.autonomyPolicy,
        action: "continue_slam_room_queue",
        safeOffline: true,
      };
    case "coordinator_queue":
      return {
        nodeId: node.nodeId,
        policy: node.autonomyPolicy,
        action: "queue_orders_until_sync",
        safeOffline: true,
      };
    default:
      return { nodeId: node.nodeId, policy: node.autonomyPolicy, action: "hold_safe", safeOffline: false };
  }
}
