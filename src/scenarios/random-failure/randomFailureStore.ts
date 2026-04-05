import { create } from "zustand";

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"];

export interface ResilienceSimAgent {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  role: "leader" | "relay" | "standby";
  alive: boolean;
  stake: number;
  status: "active" | "failed";
}

export interface FailureEvent {
  at: number;
  agentId: string;
  name: string;
}

function initialAgents(): ResilienceSimAgent[] {
  return NAMES.map((name, i) => {
    const stake = 0.25 + Math.random() * 0.7;
    const role: ResilienceSimAgent["role"] = i === 0 ? "leader" : i < 4 ? "relay" : "standby";
    return {
      id: `rf-${i}`,
      name,
      position: { x: Math.sin(i * 0.8) * 8, y: 0.9, z: -35 + i * 4 },
      role,
      alive: true,
      stake,
      status: "active",
    };
  });
}

function computeUptime(agents: ResilienceSimAgent[], initial: number): number {
  const dead = agents.filter((a) => !a.alive).length;
  const loss = dead / initial;
  return Math.max(0, 100 - loss * 3.25);
}

export interface RandomFailureState {
  agents: ResilienceSimAgent[];
  performanceUptime: number;
  agentLossRate: number;
  missionProgress: number;
  failuresHandled: number;
  noIntervention: boolean;
  failureLog: FailureEvent[];
  uptimeHistory: number[];
  simRunning: boolean;
  failureTimeScale: number;
  session: number;
  initialCount: number;
  reset: () => void;
  setSimRunning: (v: boolean) => void;
  setFailureTimeScale: (v: number) => void;
  setAgents: (agents: ResilienceSimAgent[]) => void;
  pushFailure: (e: FailureEvent) => void;
  appendUptimeSample: (u: number) => void;
  setMissionProgress: (p: number) => void;
}

export const useRandomFailureStore = create<RandomFailureState>((set, get) => ({
  agents: initialAgents(),
  performanceUptime: 100,
  agentLossRate: 0,
  missionProgress: 0,
  failuresHandled: 0,
  noIntervention: true,
  failureLog: [],
  uptimeHistory: [100],
  simRunning: true,
  failureTimeScale: 1,
  session: 0,
  initialCount: NAMES.length,

  reset: () =>
    set((s) => ({
      agents: initialAgents(),
      performanceUptime: 100,
      agentLossRate: 0,
      missionProgress: 0,
      failuresHandled: 0,
      noIntervention: true,
      failureLog: [],
      uptimeHistory: [100],
      session: s.session + 1,
    })),

  setSimRunning: (v) => set({ simRunning: v }),
  setFailureTimeScale: (v) => set({ failureTimeScale: Math.max(0.25, Math.min(4, v)) }),
  setAgents: (agents) => {
    const initial = get().initialCount;
    const dead = agents.filter((a) => !a.alive).length;
    set({
      agents,
      performanceUptime: computeUptime(agents, initial),
      agentLossRate: (dead / initial) * 100,
      failuresHandled: dead,
    });
  },
  pushFailure: (e) =>
    set((s) => ({
      failureLog: [e, ...s.failureLog].slice(0, 20),
    })),
  appendUptimeSample: (u) =>
    set((s) => ({
      uptimeHistory: [...s.uptimeHistory, u].slice(-32),
    })),
  setMissionProgress: (p) => set({ missionProgress: p }),
}));
