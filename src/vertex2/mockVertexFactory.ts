import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import { createBaselineSwarmNodeList } from "@/backend/vertex/agent-profiles";
import { enrichPeerFromNode, createProfileRng } from "./peerProfiles";
import type { MeshPeerRuntime } from "./types";

export function mockSwarmNodes(count: number, trust = 0.88): SwarmAgentNode[] {
  return createBaselineSwarmNodeList(Math.max(5, count), trust);
}

export function mockMeshPeers(nodes: SwarmAgentNode[], seed: number): MeshPeerRuntime[] {
  const rng = createProfileRng(seed);
  return nodes.map((n, i) => enrichPeerFromNode(n, i, rng));
}
