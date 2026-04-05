import type { Agent } from "@/types";

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];

function synthAgent(i: number): Agent {
  const role: Agent["role"] = i % 17 === 0 ? "explorer" : i % 4 === 0 ? "relay" : "standby";
  const seed = i * 0.413;
  return {
    id: `hero-synth-${i}`,
    name: NAMES[i % NAMES.length] + `-${i}`,
    role,
    position: {
      x: Math.sin(seed) * 18,
      y: (i % 7) * 0.25,
      z: Math.cos(seed * 1.3) * 14,
    },
    battery: 35 + (i * 37) % 65,
    status: i % 23 === 0 ? "low-battery" : "active",
    trajectory: [],
    color: role === "explorer" ? "#22d3ee" : role === "relay" ? "#818cf8" : "#64748b",
    latency: 12 + (i % 40),
    tasksCompleted: (i * 3) % 40,
    stakeAmount: 80 + (i * 97) % 900,
    currentBehavior: role === "explorer" ? "exploring" : role === "relay" ? "relaying" : "idle",
    assignedCell: null,
    targetId: null,
    isByzantine: false,
  };
}

/**
 * Pads the Zustand agent list to `target` count for a dense hero formation while keeping real agents first.
 */
export function expandHeroAgents(storeAgents: Agent[], target: number): Agent[] {
  const cap = Math.max(0, Math.floor(target));
  if (storeAgents.length >= cap) return storeAgents.slice(0, cap);
  const out = storeAgents.slice();
  let i = out.length;
  while (out.length < cap) {
    out.push(synthAgent(i));
    i++;
  }
  return out;
}
