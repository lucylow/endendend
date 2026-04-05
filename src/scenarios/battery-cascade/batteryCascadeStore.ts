import { create } from "zustand";
import type { Agent } from "@/types";

export interface PromotionEvent {
  at: number;
  agentId: string;
  name: string;
  reason: string;
}

export interface BatteryCascadeScenarioStats {
  missionExtension: number;
  cascadeTriggered: boolean;
  tashiDuration: number;
  staticDuration: number;
  recoveryComplete: boolean;
}

function tunnelAgentLayout(): Agent[] {
  const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
  return names.map((name, i) => {
    const role: Agent["role"] = i === 0 ? "explorer" : i < 4 ? "relay" : "standby";
    const z = -12 - i * 18;
    return {
      id: `agent-${i}`,
      name,
      role,
      position: { x: (i % 2) * 2 - 1, y: 0.8, z },
      battery: role === "explorer" ? 88 : role === "relay" ? 72 : 65,
      status: "active" as const,
      trajectory: [],
      color: role === "explorer" ? "#00d4ff" : role === "relay" ? "#6366f1" : "#525252",
      latency: 12 + i * 3,
      tasksCompleted: 0,
      stakeAmount: 200 + i * 120,
      currentBehavior: role === "explorer" ? "exploring" : role === "relay" ? "relaying" : "idle",
      assignedCell: null,
      targetId: null,
      isByzantine: false,
    };
  });
}

export interface BatteryCascadeState {
  agents: Agent[];
  scenarioStats: BatteryCascadeScenarioStats;
  promotionLog: PromotionEvent[];
  accelerateFailure: boolean;
  failureTimeScale: number;
  simRunning: boolean;
  /** Bumped on reset so r3f heartbeat state can remount cleanly. */
  session: number;
  reset: () => void;
  setAccelerateFailure: (v: boolean) => void;
  setFailureTimeScale: (v: number) => void;
  setSimRunning: (v: boolean) => void;
  setAgents: (agents: Agent[]) => void;
  patchAgent: (id: string, patch: Partial<Agent>) => void;
  pushPromotion: (e: Omit<PromotionEvent, "at">) => void;
  setScenarioStats: (p: Partial<BatteryCascadeScenarioStats>) => void;
}

const STATIC_BASELINE_S = 100;
const TASHI_PROJECTED_S = 142;

export const useBatteryCascadeStore = create<BatteryCascadeState>((set, get) => ({
  agents: tunnelAgentLayout(),
  scenarioStats: {
    missionExtension: 0,
    cascadeTriggered: false,
    tashiDuration: 0,
    staticDuration: STATIC_BASELINE_S,
    recoveryComplete: false,
  },
  promotionLog: [],
  accelerateFailure: false,
  failureTimeScale: 1,
  simRunning: true,
  session: 0,

  reset: () =>
    set((s) => ({
      agents: tunnelAgentLayout(),
      scenarioStats: {
        missionExtension: 0,
        cascadeTriggered: false,
        tashiDuration: 0,
        staticDuration: STATIC_BASELINE_S,
        recoveryComplete: false,
      },
      promotionLog: [],
      session: s.session + 1,
    })),

  setAccelerateFailure: (v) => set({ accelerateFailure: v }),
  setFailureTimeScale: (v) => set({ failureTimeScale: Math.max(0.25, Math.min(4, v)) }),
  setSimRunning: (v) => set({ simRunning: v }),

  setAgents: (agents) => set({ agents }),

  patchAgent: (id, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  pushPromotion: (e) =>
    set((s) => ({
      promotionLog: [{ ...e, at: performance.now() }, ...s.promotionLog].slice(0, 24),
    })),

  setScenarioStats: (p) =>
    set((s) => ({
      scenarioStats: { ...s.scenarioStats, ...p },
    })),
}));

export { STATIC_BASELINE_S, TASHI_PROJECTED_S };
