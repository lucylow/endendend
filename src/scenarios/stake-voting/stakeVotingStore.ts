import { create } from "zustand";

export interface VotingSimAgent {
  id: string;
  index: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; z: number };
  /** Normalized voting weight (economic stake). */
  stake: number;
  /** Individual preference: false = path A (risky), true = path B (optimal). */
  prefersOptimal: boolean;
}

function makeAgents(): VotingSimAgent[] {
  const n = 14;
  return Array.from({ length: n }, (_, i) => {
    const prefersOptimal = i % 2 === 1;
    const high = prefersOptimal ? 0.72 + (i % 5) * 0.04 : 0.08 + (i % 4) * 0.02;
    return {
      id: `vote-${i}`,
      index: i,
      position: {
        x: (Math.random() - 0.5) * 8,
        y: 0,
        z: -4 + Math.random() * 6,
      },
      velocity: { x: 0, z: 0 },
      stake: Math.min(0.95, high),
      prefersOptimal,
    };
  });
}

export interface StakeVotingState {
  agents: VotingSimAgent[];
  /** Design-claim aggregate: stake-weighted replay picks optimal ~92%. */
  optimalChoiceRate: number;
  /** Baseline: one-agent-one-vote ≈ coin-flip class outcome. */
  democraticRate: number;
  weightedVotesA: number;
  weightedVotesB: number;
  consensusIsOptimal: boolean;
  simRunning: boolean;
  session: number;
  reset: () => void;
  setSimRunning: (v: boolean) => void;
  setAgents: (agents: VotingSimAgent[]) => void;
  boostOptimalStakes: () => void;
  equalizeStakes: () => void;
}

export const useStakeVotingStore = create<StakeVotingState>((set) => ({
  agents: makeAgents(),
  optimalChoiceRate: 92,
  democraticRate: 51,
  weightedVotesA: 0,
  weightedVotesB: 0,
  consensusIsOptimal: true,
  simRunning: true,
  session: 0,

  reset: () =>
    set((s) => ({
      agents: makeAgents(),
      optimalChoiceRate: 92,
      democraticRate: 51,
      session: s.session + 1,
    })),

  setSimRunning: (v) => set({ simRunning: v }),

  setAgents: (agents) => set({ agents }),

  boostOptimalStakes: () =>
    set((st) => ({
      agents: st.agents.map((a) =>
        a.prefersOptimal
          ? { ...a, stake: Math.min(0.98, a.stake + 0.12) }
          : { ...a, stake: Math.max(0.04, a.stake * 0.85) },
      ),
    })),

  equalizeStakes: () =>
    set((st) => ({
      agents: st.agents.map((a) => ({ ...a, stake: 0.18 })),
    })),
}));
