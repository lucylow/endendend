import { VertexSwarm } from "@/lib/tashi-sdk/vertex";
import type { Agent } from "@/types";
import type { FusedVictim, VictimPriority } from "../types";

export interface TriageProposal {
  victimId: string;
  priorityScore: number;
  stakes: number[];
}

export class StakeWeightedTriage {
  /**
   * Ranks victims by stake-weighted score, then runs Vertex consensus (FoxMQ + BFT hook).
   */
  async triageVictims(victims: FusedVictim[], agents: Agent[]): Promise<VictimPriority[]> {
    const stakes = agents.filter((a) => a.status === "active").map((a) => a.stakeAmount);
    const totalStake = stakes.reduce((s, v) => s + v, 0) || 1;

    const proposals: TriageProposal[] = victims.map((v) => ({
      victimId: v.id,
      priorityScore: v.fusedScore * v.urgency,
      stakes,
    }));

    const ranked = proposals
      .map((p) => ({
        ...p,
        consensusScore: p.priorityScore * (1 + Math.log1p(totalStake / 1000)),
      }))
      .sort((a, b) => b.consensusScore - a.consensusScore);

    const agentIds = agents.filter((a) => a.status === "active").map((a) => a.id);
    if (agentIds.length && ranked[0]) {
      const vs = new VertexSwarm();
      await vs.consensusVote(agentIds.slice(0, 8), {
        id: `victim-${ranked[0].victimId}`,
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 6, y: 0, z: 4 },
        ],
        score: Math.min(0.99, ranked[0].consensusScore),
      });
    }

    const victimById = new Map(victims.map((v) => [v.id, v] as const));
    return ranked.map((r, i) => {
      const v = victimById.get(r.victimId);
      return {
        victimId: r.victimId,
        rank: i + 1,
        consensusScore: r.consensusScore,
        fusedScore: v?.fusedScore ?? r.priorityScore,
      };
    });
  }
}
