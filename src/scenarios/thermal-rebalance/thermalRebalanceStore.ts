import { create } from "zustand";
import type { Agent } from "@/types";

export interface ThermalSimAgent extends Agent {
  temperature: number;
  emergencyActive: boolean;
  velocity: { x: number; z: number };
}

function rover(id: string, name: string, x: number, z: number, stake: number): ThermalSimAgent {
  return {
    id,
    name,
    role: "relay",
    position: { x, y: 0.8, z },
    battery: 82,
    status: "active",
    trajectory: [],
    color: "#22d3ee",
    latency: 18,
    tasksCompleted: 0,
    stakeAmount: stake,
    currentBehavior: "relaying",
    assignedCell: null,
    targetId: null,
    isByzantine: false,
    temperature: 26 + Math.random() * 4,
    emergencyActive: false,
    velocity: { x: 0, z: 0 },
  };
}

function initialAgents(): ThermalSimAgent[] {
  return [
    rover("rover-1", "Rover-1", -2.2, 1.4, 420),
    rover("rover-2", "Rover-2", 2.0, -1.2, 380),
    rover("rover-3", "Rover-3", -1.0, -2.0, 510),
    rover("rover-4", "Rover-4", 1.2, 2.2, 450),
  ];
}

export interface ThermalRebalanceState {
  agents: ThermalSimAgent[];
  simRunning: boolean;
  recoveryTime: number;
  coolingSuccess: boolean;
  emergencyEver: boolean;
  emergencyStartedAt: number | null;
  session: number;
  reset: () => void;
  setSimRunning: (v: boolean) => void;
  setAgents: (agents: ThermalSimAgent[]) => void;
  patchScenario: (
    p: Partial<Pick<ThermalRebalanceState, "recoveryTime" | "coolingSuccess" | "emergencyEver" | "emergencyStartedAt">>,
  ) => void;
}

export const TARGET_RECOVERY_S = 92;

export const useThermalRebalanceStore = create<ThermalRebalanceState>((set, get) => ({
  agents: initialAgents(),
  simRunning: true,
  recoveryTime: 0,
  coolingSuccess: false,
  emergencyEver: false,
  emergencyStartedAt: null,
  session: 0,

  reset: () =>
    set((s) => ({
      agents: initialAgents(),
      recoveryTime: 0,
      coolingSuccess: false,
      emergencyEver: false,
      emergencyStartedAt: null,
      session: s.session + 1,
    })),

  setSimRunning: (v) => set({ simRunning: v }),

  setAgents: (agents) => set({ agents }),

  patchScenario: (p) => set((s) => ({ ...s, ...p })),
}));

export function thermalColor(temp: number): string {
  const t = Math.max(20, Math.min(100, temp));
  if (t < 45) return "#38bdf8";
  if (t < 65) return "#fbbf24";
  if (t < 80) return "#f97316";
  return "#ef4444";
}
