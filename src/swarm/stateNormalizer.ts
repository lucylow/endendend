import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import type { SwarmAgentNode, SwarmTaskSpec, GraphEdge } from "@/backend/vertex/swarm-types";
import type { TargetCandidate } from "./types";
import { buildPeerReachabilityTable, buildPeerLinkViews, summarizePartitions, type PeerReachability, type PeerLinkView } from "./networkModel";
import { derivePeerProfile } from "./peerProfiles";
import type { NormalizedPeer } from "./peerProfiles";

export type NormalizedTask = SwarmTaskSpec & { source: "simulation" };

export type NormalizedTarget = TargetCandidate & { source: "simulation" };

export type NormalizedSwarmUI = {
  source: "vertex_swarm_simulator";
  missionId: string;
  nowMs: number;
  scenario: string;
  phase: string;
  connectivityMode: string;
  peers: NormalizedPeer[];
  links: PeerLinkView[];
  reachability: Map<string, PeerReachability>;
  partition: ReturnType<typeof summarizePartitions>;
  tasks: NormalizedTask[];
  targets: NormalizedTarget[];
  mapCoverage01: number;
  frontierCount: number;
  raw: VertexSwarmView;
};

function safeNodes(view: VertexSwarmView): SwarmAgentNode[] {
  return Array.isArray(view.nodes) ? view.nodes : [];
}

function safeEdges(view: VertexSwarmView): GraphEdge[] {
  return view.graph?.edges ?? [];
}

/** Turns partial / simulator-specific payloads into stable UI models (never throws). */
export function normalizeSwarmView(view: VertexSwarmView | null): NormalizedSwarmUI | null {
  if (!view) return null;
  const operatorId = view.operatorNodeId ?? "agent-cmd-e";
  try {
    const nodes = safeNodes(view);
    const snap = view.graph ?? {
      edges: [] as GraphEdge[],
      partitionClusters: [],
      operatorReachable: new Set<string>(),
      relayChains: [],
      stalePeers: new Set<string>(),
    };
    const reach = buildPeerReachabilityTable(nodes, snap, operatorId);
    const links = buildPeerLinkViews(snap, operatorId, reach);
    const partition = summarizePartitions(
      snap,
      operatorId,
      nodes.map((n) => n.nodeId),
    );
    const peers = nodes.map((n) => {
      const tel = view.telemetry?.find((t) => t.nodeId === n.nodeId);
      const aut = view.autonomy?.find((a) => a.nodeId === n.nodeId);
      const r = reach.get(n.nodeId);
      return derivePeerProfile(n, tel, aut, r, view.connectivityMode);
    });
    const tasks = (view.tasks ?? []).map((t) => ({ ...t, source: "simulation" as const }));
    const targets = (view.discovery ?? []).map((d) => ({ ...d, source: "simulation" as const }));
    return {
      source: "vertex_swarm_simulator",
      missionId: view.missionId ?? "unknown",
      nowMs: view.nowMs ?? Date.now(),
      scenario: String(view.scenario ?? ""),
      phase: String(view.phase ?? ""),
      connectivityMode: String(view.connectivityMode ?? ""),
      peers,
      links,
      reachability: reach,
      partition,
      tasks,
      targets,
      mapCoverage01: view.sharedMap?.coverage01 ?? 0,
      frontierCount: view.sharedMap?.frontier ?? 0,
      raw: view,
    };
  } catch {
    return {
      source: "vertex_swarm_simulator",
      missionId: view.missionId ?? "unknown",
      nowMs: Date.now(),
      scenario: "",
      phase: "",
      connectivityMode: "",
      peers: [],
      links: [],
      reachability: new Map(),
      partition: {
        clusterCount: 0,
        largestPartitionSize: 0,
        operatorPartitionSize: 0,
        isolatedFromOperator: [],
      },
      tasks: [],
      targets: [],
      mapCoverage01: 0,
      frontierCount: 0,
      raw: view,
    };
  }
}
