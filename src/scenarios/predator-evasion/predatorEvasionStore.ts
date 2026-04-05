import { create } from "zustand";
import type { EvasionPhase, EvasionSimAgent } from "./EvasionManeuverEngine";

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"];

function initialAgents(): EvasionSimAgent[] {
  return NAMES.map((name, i) => ({
    id: `evasion-${i}`,
    name,
    position: {
      x: Math.sin(i * 0.7) * 6,
      y: 0.6,
      z: -8 + i * 2.2,
    },
    evasionPhase: "idle" as EvasionPhase,
  }));
}

export interface PredatorEvasionState {
  agents: EvasionSimAgent[];
  forklift: { x: number; z: number };
  /** Sim seconds */
  simTime: number;
  simRunning: boolean;
  threatActive: boolean;
  /** Sim time when threat sequence began; drives scatter/reform phases. */
  threatT0: number | null;
  /** When false, auto threat at t>8s is suppressed until reset. */
  threatArmed: boolean;
  narrative: string;
  zeroCollisions: boolean;
  /** Seconds — Tashi orthogonal scatter + reform */
  evasionDelaySec: number;
  /** Baseline if formation stayed static */
  staticDelaySec: number;
  threatDistanceM: number;
  collisionRiskPct: number;
  agentsSafe: string;
  missionDelaySec: number;
  session: number;
  failureTimeScale: number;
  reset: () => void;
  setSimRunning: (v: boolean) => void;
  setFailureTimeScale: (v: number) => void;
  setAgents: (agents: EvasionSimAgent[]) => void;
  patchForklift: (p: Partial<{ x: number; z: number }>) => void;
  setMetrics: (p: Partial<Omit<PredatorEvasionState, "agents" | "forklift" | "session" | "reset" | "setSimRunning" | "setFailureTimeScale" | "setAgents" | "patchForklift" | "setMetrics">>) => void;
}

export const usePredatorEvasionStore = create<PredatorEvasionState>((set) => ({
  agents: initialAgents(),
  forklift: { x: -32, z: 2 },
  simTime: 0,
  simRunning: true,
  threatActive: false,
  threatT0: null,
  threatArmed: true,
  narrative: "Normal formation continuing mission",
  zeroCollisions: true,
  evasionDelaySec: 0,
  staticDelaySec: 8,
  threatDistanceM: 42,
  collisionRiskPct: 0,
  agentsSafe: "10/10",
  missionDelaySec: 0,
  session: 0,
  failureTimeScale: 1,

  reset: () =>
    set((s) => ({
      agents: initialAgents(),
      forklift: { x: -32, z: 2 },
      simTime: 0,
      threatActive: false,
      threatT0: null,
      threatArmed: true,
      narrative: "Normal formation continuing mission",
      zeroCollisions: true,
      threatDistanceM: 42,
      collisionRiskPct: 0,
      agentsSafe: "10/10",
      missionDelaySec: 0,
      session: s.session + 1,
    })),

  setSimRunning: (v) => set({ simRunning: v }),
  setFailureTimeScale: (v) => set({ failureTimeScale: Math.max(0.25, Math.min(4, v)) }),
  setAgents: (agents) => set({ agents }),
  patchForklift: (p) => set((s) => ({ forklift: { ...s.forklift, ...p } })),
  setMetrics: (p) => set(p),
}));
