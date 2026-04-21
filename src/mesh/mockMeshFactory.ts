import { mulberry32 } from "@/swarm/seededRng";
import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import { createBaselineSwarmNodeList } from "@/backend/vertex/agent-profiles";
import { buildRichProfile, clusterIdForNode } from "./nodeProfiles";
import type { MeshPeerRichProfile } from "./types";

export function createMockMeshPeers(agentCount: number, seed: number, nowMs: number, clusters: string[][]): MeshPeerRichProfile[] {
  const rng = mulberry32(seed >>> 0);
  const nodes = createBaselineSwarmNodeList(agentCount, 0.88 + rng() * 0.1);
  return nodes.map((n, i) => {
    const p = buildRichProfile(n, i, nowMs, clusterIdForNode(n.nodeId, clusters));
    return { ...p, battery01: Math.max(0.12, 0.92 - rng() * 0.25), localQueueDepth: Math.floor(rng() * 8) };
  });
}

export function mockSwarmNodesForMesh(agentCount: number, seed: number): SwarmAgentNode[] {
  return createBaselineSwarmNodeList(agentCount, 0.9);
}
