import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import type { FlatMissionEnvelope } from "@/lib/state/types";
import { TERMINAL_PHASES } from "@/backend/shared/mission-phases";

const HB_STALE_MS = 12_000;

function healthForNode(
  view: VertexSwarmView,
  nodeId: string,
  battery01: number | undefined,
): FlatMissionEnvelope["nodes"][0]["health"] {
  const n = view.nodes.find((x) => x.nodeId === nodeId);
  if (!n) return "stale";
  if (n.offline) return "stale";
  const hb = n.lastHeartbeatMs ?? view.nowMs;
  if (view.nowMs - hb > HB_STALE_MS) return "stale";
  if (view.graph.stalePeers.has(nodeId)) return "degraded";
  if (typeof battery01 === "number" && battery01 < 0.22) return "degraded";
  if (n.healthStatus === "degraded") return "degraded";
  if (view.nowMs - hb > 2_500) return "syncing";
  return "online";
}

function buildAlerts(view: VertexSwarmView): FlatMissionEnvelope["alerts"] {
  const alerts: FlatMissionEnvelope["alerts"] = [];
  if (view.blackoutActive) {
    alerts.push({
      type: "mesh_blackout",
      severity: "critical",
      nodeId: "mesh",
      message: "Mesh blackout — operator path degraded",
    });
  }
  for (const n of view.nodes) {
    const tel = view.telemetry.find((t) => t.nodeId === n.nodeId);
    if (tel && tel.battery01 < 0.18) {
      alerts.push({
        type: "battery_low",
        severity: "warning",
        nodeId: n.nodeId,
        message: `Battery critical on ${n.displayName}`,
      });
    }
    if (n.offline) {
      alerts.push({
        type: "node_offline",
        severity: "critical",
        nodeId: n.nodeId,
        message: `${n.displayName} offline / partitioned`,
      });
    }
  }
  if (view.graph.partitionClusters.length > 1) {
    alerts.push({
      type: "mesh_partition",
      severity: "warning",
      nodeId: "mesh",
      message: `${view.graph.partitionClusters.length} partition clusters detected`,
    });
  }
  return alerts;
}

function recoveryFromView(view: VertexSwarmView): FlatMissionEnvelope["recovery"] {
  if (view.blackoutActive) {
    return { state: "isolated", checkpointLag: view.ledgerTail.length, mapLagPct: Math.round((1 - view.sharedMap.coverage01) * 40) };
  }
  const pending = view.meshV2?.consensus.health.pending ?? 0;
  if (pending > 6) {
    return { state: "syncing", checkpointLag: view.ledgerTail.length, mapLagPct: Math.min(30, pending * 3) };
  }
  if (view.connectivityMode === "fallback_local") {
    return { state: "degraded", checkpointLag: view.ledgerTail.length, mapLagPct: 12 };
  }
  return { state: "recovered", checkpointLag: 0, mapLagPct: Math.round((1 - view.sharedMap.coverage01) * 8) };
}

/** Derive the flat SAR envelope consumed by scenario shells and ops panels. */
export function vertexViewToFlatEnvelope(view: VertexSwarmView | null): FlatMissionEnvelope | null {
  if (!view) return null;

  const targets = view.discovery
    .filter((d) => d.status === "confirmed" || d.status === "candidate")
    .map((d) => ({
      id: d.candidateId,
      confidence: d.mergedConfidence01,
      status: d.status,
    }));

  const nodes: FlatMissionEnvelope["nodes"] = view.nodes.map((n) => {
    const tel = view.telemetry.find((t) => t.nodeId === n.nodeId);
    const battery = tel?.battery01 ?? 0.75;
    const tasks = view.tasks.filter(
      (t) => t.winnerNodeId === n.nodeId && (t.status === "assigned" || t.status === "bidding" || t.status === "open"),
    ).length;
    return {
      nodeId: n.nodeId,
      role: n.role,
      trust: Math.round(n.trust01 * 1000) / 1000,
      battery: Math.round(battery * 1000) / 1000,
      health: healthForNode(view, n.nodeId, tel?.battery01),
      activeTasks: tasks,
    };
  });

  const tail = view.ledgerTail[0];
  const settlement =
    TERMINAL_PHASES.has(view.phase) && tail
      ? { ready: true, manifestHash: tail.eventHash.slice(0, 24) }
      : undefined;

  return {
    missionId: view.missionId,
    scenario: view.scenario,
    phase: view.phase,
    mapSummary: {
      exploredCells: view.sharedMap.explored,
      coveragePercent: Math.min(100, Math.round(view.sharedMap.coverage01 * 1000) / 10),
      targets,
    },
    nodes,
    alerts: buildAlerts(view),
    recovery: recoveryFromView(view),
    settlement,
    source: "local_engine",
    capturedAtMs: view.nowMs,
  };
}
