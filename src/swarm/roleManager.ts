import type { MissionNodeRole } from "@/backend/shared/mission-state";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { TargetCandidate } from "./types";
import type { RoleHandoffRecord } from "./types";

type Rng = () => number;

function sortByMesh(nodes: SwarmAgentNode[]): SwarmAgentNode[] {
  return [...nodes].sort((a, b) => b.capabilities.meshRangeM - a.capabilities.meshRangeM);
}

/**
 * Evidence-driven role hand-offs — no central orchestrator: rules react to mesh + mission artifacts.
 */
export class RoleHandoffCoordinator {
  private history: RoleHandoffRecord[] = [];

  getHistory(): RoleHandoffRecord[] {
    return [...this.history];
  }

  applyHandoff(node: SwarmAgentNode, to: MissionNodeRole, reason: string, evidence: string, nowMs: number): boolean {
    if (node.role === to) return false;
    const rec: RoleHandoffRecord = {
      atMs: nowMs,
      nodeId: node.nodeId,
      fromRole: node.role,
      toRole: to,
      reason,
      evidence,
    };
    this.history.unshift(rec);
    node.role = to;
    return true;
  }

  /**
   * Evaluate decentralized promotions: relay under blackout, medic on confirmed target, observer as interim command.
   */
  evaluate(args: {
    nodes: SwarmAgentNode[];
    connectivityMode: VertexConnectivityMode;
    confirmedTargets: TargetCandidate[];
    operatorReachable: Set<string>;
    nowMs: number;
    rng: Rng;
  }): RoleHandoffRecord[] {
    const { nodes, connectivityMode, confirmedTargets, operatorReachable, nowMs, rng } = args;
    const delta: RoleHandoffRecord[] = [];

    const meshOrder = sortByMesh(nodes);
    const leader = meshOrder.find((n) => n.role === "observer") ?? meshOrder[0];

    if ((connectivityMode === "blackout" || connectivityMode === "partial_partition") && rng() < 0.45) {
      const relay = nodes.find((n) => n.role === "relay");
      const bestMesh = meshOrder[0];
      if (relay && bestMesh && bestMesh.nodeId !== relay.nodeId && bestMesh.capabilities.meshRangeM > relay.capabilities.meshRangeM) {
        if (this.applyHandoff(bestMesh, "relay", "mesh_promotion", "highest_range_during_partition", nowMs)) {
          delta.push(this.history[0]);
        }
      }
      for (const n of nodes) {
        if (n.role !== "explorer") continue;
        if (!operatorReachable.has(n.nodeId) && rng() < 0.35) {
          if (this.applyHandoff(n, "relay", "local_relay", "isolated_explorer_keeps_mesh", nowMs)) {
            delta.push(this.history[0]);
          }
        }
      }
    }

    for (const t of confirmedTargets) {
      const medic = nodes
        .filter((n) => n.role === "carrier" || n.capabilities.gripperScore > 0.5)
        .sort((a, b) => b.capabilities.thermalScore - a.capabilities.thermalScore)[0];
      if (medic && medic.role === "carrier" && rng() < 0.55) {
        if (this.applyHandoff(medic, "medic", "triage_after_target", `target=${t.candidateId}`, nowMs)) {
          delta.push(this.history[0]);
        }
      }
      const rescuer = nodes
        .filter((n) => n.capabilities.gripperScore > 0.7)
        .sort((a, b) => b.capabilities.maxPayloadKg - a.capabilities.maxPayloadKg)[0];
      if (rescuer && rescuer.role === "medic" && rng() < 0.4) {
        if (this.applyHandoff(rescuer, "carrier", "extraction_handoff", `payload_for=${t.candidateId}`, nowMs)) {
          delta.push(this.history[0]);
        }
      }
    }

    if (leader && !operatorReachable.has(leader.nodeId) && connectivityMode !== "normal") {
      const standby = nodes.find((n) => n.role === "relay" || n.role === "observer");
      if (standby && rng() < 0.25) {
        if (this.applyHandoff(standby, "observer", "interim_command", "operator_unreachable", nowMs)) {
          delta.push(this.history[0]);
        }
      }
    }

    return delta;
  }
}
