import { useSwarmStore } from "@/store/swarmStore";
import { foxmqWeightedBroadcast } from "./foxmqBridge";
import type { SwarmGatewayClient } from "./swarmGatewayClient";
import type { PathProposal } from "./types";

export type { PathProposal } from "./types";

export type VertexSwarmOptions = {
  /** When set (``VITE_SWARM_BACKEND_HTTP``), best-effort mesh health read after local consensus. */
  meshGateway?: SwarmGatewayClient | null;
};

/**
 * Vertex-style consensus over weighted FoxMQ broadcasts (simulated against the live swarm store).
 * Optionally pings the Python mesh gateway so UI and HTTP snapshot stay correlated.
 */
export class VertexSwarm {
  constructor(private readonly opts: VertexSwarmOptions = {}) {}

  async consensusVote(agentIds: string[], proposal: PathProposal): Promise<PathProposal> {
    const agents = useSwarmStore.getState().agents.filter((a) => agentIds.includes(a.id));
    const stakes = agents.map((a) => a.stakeAmount);
    await foxmqWeightedBroadcast(proposal, stakes);
    useSwarmStore.getState().runConsensus("task_acceptance");
    const next = { ...proposal, score: proposal.score * (0.94 + Math.random() * 0.06) };
    const gw = this.opts.meshGateway;
    const nodeId = agents[0]?.id;
    if (gw && nodeId) {
      try {
        await gw.postCommand(nodeId, "get_health", {}, true);
      } catch {
        /* offline backend — simulation still valid */
      }
    }
    return next;
  }
}
