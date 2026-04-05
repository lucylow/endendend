import { useSwarmStore } from "@/store/swarmStore";
import { foxmqWeightedBroadcast } from "./foxmqBridge";
import type { PathProposal } from "./types";

export type { PathProposal } from "./types";

/**
 * Vertex-style consensus over weighted FoxMQ broadcasts (simulated against the live swarm store).
 */
export class VertexSwarm {
  async consensusVote(agentIds: string[], proposal: PathProposal): Promise<PathProposal> {
    const agents = useSwarmStore.getState().agents.filter((a) => agentIds.includes(a.id));
    const stakes = agents.map((a) => a.stakeAmount);
    await foxmqWeightedBroadcast(proposal, stakes);
    useSwarmStore.getState().runConsensus("task_acceptance");
    return { ...proposal, score: proposal.score * (0.94 + Math.random() * 0.06) };
  }
}
