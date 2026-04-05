import type { VictimScenarioAgent } from "@/store/scenarioVizStore";

export class StakeVotingEngine {
  calculatePriority(agent: VictimScenarioAgent, victimPos: { x: number; z: number }): number {
    const distance = Math.hypot(agent.position.x - victimPos.x, agent.position.z - victimPos.z);
    const stakeWeight = agent.stake;
    return (1 / (distance + 1)) * stakeWeight;
  }

  assignRole(agent: VictimScenarioAgent, allAgents: VictimScenarioAgent[], victimPos: { x: number; z: number }): VictimScenarioAgent["rescueRole"] {
    const priorities = allAgents.map((a) => this.calculatePriority(a, victimPos));
    const totalPriority = priorities.reduce((sum, p) => sum + p, 0) || 1;
    const idx = allAgents.findIndex((a) => a.id === agent.id);
    const agentPriorityShare = (priorities[idx] ?? 0) / totalPriority;
    if (agentPriorityShare > 0.25) return "converge";
    if (agentPriorityShare > 0.15) return "relay";
    return "search";
  }
}
