import type { GraphEdge, ConnectivitySnapshot, SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";

export type PeerLinkKind = "direct" | "degraded" | "relayed" | "stale";

export type PeerLinkView = {
  peerA: string;
  peerB: string;
  quality01: number;
  latencyMs: number;
  loss: number;
  kind: PeerLinkKind;
  /** When operator is not a direct hop, first mesh hop toward a peer that reaches the operator. */
  relayHint?: string;
};

export type PeerReachability = {
  nodeId: string;
  /** Max quality among incident edges (local mesh backbone). */
  meshBackbone01: number;
  /** Best path quality toward operator: direct edge or one relay hop through an operator-reachable peer. */
  effectiveOperatorPath01: number;
  /** True if this node appears in operatorReachable (direct multi-hop path in graph snapshot). */
  operatorReachable: boolean;
  /** Whether the best path to operator uses a relay hop (no usable direct edge). */
  usesRelayToOperator: boolean;
  /** When `usesRelayToOperator`, the first hop peer toward the operator. */
  relayPeer?: string;
};

function edgeBetween(edges: GraphEdge[], a: string, b: string): GraphEdge | undefined {
  return edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

/**
 * Estimates how well a node can coordinate with the rest of the swarm toward the operator,
 * without assuming a star topology: uses direct operator link or a single peer relay hop.
 */
export function effectiveOperatorPathQuality(
  edges: GraphEdge[],
  operatorReachable: Set<string>,
  nodeId: string,
  operatorId: string,
): { quality01: number; usesRelay: boolean; relayPeer?: string } {
  const direct = edgeBetween(edges, nodeId, operatorId)?.quality01 ?? 0;
  let bestRelay = 0;
  let relayPeer: string | undefined;
  for (const e of edges) {
    const peer = e.a === nodeId ? e.b : e.b === nodeId ? e.a : null;
    if (!peer || peer === operatorId) continue;
    if (!operatorReachable.has(peer)) continue;
    const peerToOp = edgeBetween(edges, peer, operatorId)?.quality01 ?? 0;
    const bottled = Math.min(e.quality01, peerToOp) * 0.94;
    if (bottled > bestRelay) {
      bestRelay = bottled;
      relayPeer = peer;
    }
  }
  let meshBack = 0;
  for (const e of edges) {
    if (e.a !== nodeId && e.b !== nodeId) continue;
    meshBack = Math.max(meshBack, e.quality01);
  }
  const partitioned = !operatorReachable.has(nodeId);
  const combined = partitioned ? Math.max(direct, bestRelay, meshBack * 0.82) : Math.max(direct, bestRelay);
  const usesRelay = bestRelay >= combined - 1e-6 && bestRelay > direct + 0.02;
  return {
    quality01: Math.max(0.06, Math.min(1, combined)),
    usesRelay,
    relayPeer: usesRelay ? relayPeer : undefined,
  };
}

export function buildPeerReachabilityTable(
  nodes: SwarmAgentNode[],
  snap: ConnectivitySnapshot,
  operatorId: string,
): Map<string, PeerReachability> {
  const m = new Map<string, PeerReachability>();
  const edges = snap.edges;
  for (const n of nodes) {
    const { quality01, usesRelay, relayPeer } = effectiveOperatorPathQuality(edges, snap.operatorReachable, n.nodeId, operatorId);
    let meshBackbone01 = 0;
    for (const e of edges) {
      if (e.a === n.nodeId || e.b === n.nodeId) meshBackbone01 = Math.max(meshBackbone01, e.quality01);
    }
    m.set(n.nodeId, {
      nodeId: n.nodeId,
      meshBackbone01,
      effectiveOperatorPath01: quality01,
      operatorReachable: snap.operatorReachable.has(n.nodeId),
      usesRelayToOperator: usesRelay,
      relayPeer,
    });
  }
  return m;
}

function linkKind(q: number, stale: Set<string>, a: string, b: string): PeerLinkKind {
  if (stale.has(a) || stale.has(b)) return "stale";
  if (q < 0.18) return "degraded";
  if (q < 0.35) return "relayed";
  return "direct";
}

export function buildPeerLinkViews(
  snap: ConnectivitySnapshot,
  operatorId: string,
  reach: Map<string, PeerReachability>,
): PeerLinkView[] {
  const out: PeerLinkView[] = [];
  for (const e of snap.edges) {
    const ra = reach.get(e.a);
    const rb = reach.get(e.b);
    const touchesOp = e.a === operatorId || e.b === operatorId;
    const relayAssist = !touchesOp && (ra?.usesRelayToOperator || rb?.usesRelayToOperator);
    const kind = linkKind(e.quality01, snap.stalePeers, e.a, e.b);
    const relayHint =
      relayAssist ? (ra?.usesRelayToOperator ? ra.relayPeer : rb?.relayPeer) : touchesOp ? (ra?.relayPeer ?? rb?.relayPeer) : undefined;
    out.push({
      peerA: e.a,
      peerB: e.b,
      quality01: e.quality01,
      latencyMs: e.latencyMs,
      loss: e.loss,
      kind: relayAssist && kind === "direct" ? "relayed" : kind,
      relayHint,
    });
  }
  return out;
}

export type PartitionSummary = {
  clusterCount: number;
  largestPartitionSize: number;
  operatorPartitionSize: number;
  /** Human-readable partition boundary hint: nodes not in operator's BFS component. */
  isolatedFromOperator: string[];
};

export function summarizePartitions(snap: ConnectivitySnapshot, operatorId: string, allNodeIds: string[]): PartitionSummary {
  const opCluster = snap.partitionClusters.find((c) => c.includes(operatorId)) ?? [];
  const isolated = allNodeIds.filter((id) => !snap.operatorReachable.has(id));
  const largest = snap.partitionClusters.reduce((m, c) => Math.max(m, c.length), 0);
  return {
    clusterCount: snap.partitionClusters.length,
    largestPartitionSize: largest,
    operatorPartitionSize: opCluster.length,
    isolatedFromOperator: isolated,
  };
}

export function connectivityStressLabel(mode: VertexConnectivityMode): string {
  switch (mode) {
    case "normal":
      return "nominal";
    case "degraded":
      return "lossy_links";
    case "partial_partition":
      return "split_mesh";
    case "blackout":
      return "wide_partition";
    case "recovery":
      return "reconciling";
    default:
      return String(mode);
  }
}

export function pickBestReroutePeer(nodes: SwarmAgentNode[], snap: ConnectivitySnapshot): string | undefined {
  const relays = nodes.filter((n) => n.role === "relay" && !n.offline);
  if (!relays.length) return nodes.find((n) => !n.offline && snap.operatorReachable.has(n.nodeId))?.nodeId;
  return [...relays].sort((a, b) => b.capabilities.meshRangeM - a.capabilities.meshRangeM)[0]?.nodeId;
}
