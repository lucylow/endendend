import { create } from "zustand";
import type { Agent } from "@/types";

const NAMES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"];

function ringAgents(): Agent[] {
  const r = 22;
  return NAMES.map((name, i) => {
    const t = (i / NAMES.length) * Math.PI * 2;
    return {
      id: `ob-${i}`,
      name,
      role: "explorer" as const,
      position: { x: Math.cos(t) * r, y: 1, z: Math.sin(t) * r },
      battery: 80 + Math.random() * 15,
      status: "active" as const,
      trajectory: [],
      color: "#3b82f6",
      latency: 15,
      tasksCompleted: 0,
      stakeAmount: 120 + i * 55,
      currentBehavior: "exploring" as const,
      assignedCell: null,
      targetId: null,
      isByzantine: false,
    };
  });
}

export type BypassMode = "swarm" | "leader-follower";

export interface ObstacleBypassState {
  agents: Agent[];
  mode: BypassMode;
  /** Rolling collision events (pillar hull). */
  collisionsSwarm: number;
  collisionsLeader: number;
  framesSwarm: number;
  framesLeader: number;
  clearanceRate: number;
  /** Agents publishing obstacle vectors (swarm mode). */
  vectorShareCount: number;
  pillarProximity: boolean;
  simRunning: boolean;
  session: number;
  reset: () => void;
  setMode: (m: BypassMode) => void;
  setSimRunning: (v: boolean) => void;
  setAgents: (agents: Agent[]) => void;
  bumpCollision: (mode: BypassMode) => void;
  tickFrame: (mode: BypassMode) => void;
  setClearanceRate: (n: number) => void;
}

export const useObstacleBypassStore = create<ObstacleBypassState>((set) => ({
  agents: ringAgents(),
  mode: "swarm",
  collisionsSwarm: 0,
  collisionsLeader: 0,
  framesSwarm: 0,
  framesLeader: 0,
  clearanceRate: 100,
  vectorShareCount: 0,
  pillarProximity: false,
  simRunning: true,
  session: 0,

  reset: () =>
    set((s) => ({
      agents: ringAgents(),
      collisionsSwarm: 0,
      collisionsLeader: 0,
      framesSwarm: 0,
      framesLeader: 0,
      clearanceRate: 100,
      vectorShareCount: 0,
      pillarProximity: false,
      session: s.session + 1,
    })),

  setMode: (m) => set({ mode: m }),
  setSimRunning: (v) => set({ simRunning: v }),
  setAgents: (agents) => set({ agents }),

  bumpCollision: (mode) =>
    set((s) =>
      mode === "swarm"
        ? { collisionsSwarm: s.collisionsSwarm + 1 }
        : { collisionsLeader: s.collisionsLeader + 1 },
    ),

  tickFrame: (mode) =>
    set((s) =>
      mode === "swarm"
        ? { framesSwarm: s.framesSwarm + 1 }
        : { framesLeader: s.framesLeader + 1 },
    ),

  setClearanceRate: (n) => set({ clearanceRate: n }),
}));
