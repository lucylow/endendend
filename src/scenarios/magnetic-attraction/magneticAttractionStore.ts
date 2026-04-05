import { create } from "zustand";
import type { Agent } from "@/types";

export interface MagneticSimAgent extends Agent {
  velocity: { x: number; z: number };
  vizScale: number;
  emissiveIntensity: number;
}

function agent(id: string, name: string, x: number, z: number, stake: number): MagneticSimAgent {
  return {
    id,
    name,
    role: "explorer",
    position: { x, y: 0.6, z },
    battery: 90,
    status: "active",
    trajectory: [],
    color: "#a78bfa",
    latency: 14,
    tasksCompleted: 0,
    stakeAmount: stake,
    currentBehavior: "exploring",
    assignedCell: null,
    targetId: null,
    isByzantine: false,
    velocity: { x: (Math.random() - 0.5) * 0.08, z: (Math.random() - 0.5) * 0.08 },
    vizScale: 1,
    emissiveIntensity: 0.5,
  };
}

function initialAgents(): MagneticSimAgent[] {
  return [
    agent("mag-1", "Vertex-1", -8, 12, 320),
    agent("mag-2", "Vertex-2", 10, 14, 480),
    agent("mag-3", "Vertex-3", 6, -10, 260),
    agent("mag-4", "Vertex-4", -12, -8, 410),
    agent("mag-5", "Vertex-5", 2, 22, 360),
    agent("mag-6", "Vertex-6", -4, 4, 520),
  ];
}

export interface MagneticAttractionState {
  agents: MagneticSimAgent[];
  optimalSelectionRate: number;
  randomRate: number;
  attractionActive: boolean;
  convergenceTargetId: string;
  simRunning: boolean;
  session: number;
  reset: () => void;
  setSimRunning: (v: boolean) => void;
  setAgents: (agents: MagneticSimAgent[]) => void;
  setVictimValue: (id: string, value: number) => void;
  victims: { id: string; x: number; z: number; value: number; color: string }[];
}

const DEFAULT_VICTIMS: MagneticAttractionState["victims"] = [
  { id: "V1", x: -25, z: -20, value: 0.2, color: "#f87171" },
  { id: "V2", x: 15, z: -30, value: 0.3, color: "#f59e0b" },
  { id: "V3", x: -10, z: 20, value: 0.4, color: "#eab308" },
  { id: "V4", x: 25, z: 10, value: 0.6, color: "#22c55e" },
  { id: "V5", x: 0, z: -40, value: 0.7, color: "#10b981" },
  { id: "V6", x: -5, z: 0, value: 0.9, color: "#059669" },
];

export const useMagneticAttractionStore = create<MagneticAttractionState>((set) => ({
  agents: initialAgents(),
  optimalSelectionRate: 62,
  randomRate: 42,
  attractionActive: true,
  convergenceTargetId: "V6",
  simRunning: true,
  session: 0,
  victims: DEFAULT_VICTIMS,

  reset: () =>
    set((s) => ({
      agents: initialAgents(),
      optimalSelectionRate: 62,
      randomRate: 42,
      convergenceTargetId: "V6",
      victims: DEFAULT_VICTIMS.map((v) => ({ ...v })),
      session: s.session + 1,
    })),

  setSimRunning: (v) => set({ simRunning: v }),

  setAgents: (agents) => set({ agents }),

  setVictimValue: (id, value) =>
    set((s) => ({
      victims: s.victims.map((v) => (v.id === id ? { ...v, value: Math.max(0.05, Math.min(1, value)) } : v)),
    })),
}));
