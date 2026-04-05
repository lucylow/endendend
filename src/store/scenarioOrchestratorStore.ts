import { create } from "zustand";

export type ChaosLevel = 0 | 1 | 2 | 3;

interface ScenarioOrchestratorState {
  chaosLevel: ChaosLevel;
  /** KPI targets for judge narrative (simulated / design goals). */
  performance: { uptime: number; speedupVsStatic: number; consensusOptimality: number };
  setChaosLevel: (level: ChaosLevel) => void;
  bumpPerformanceDemo: () => void;
}

export const useScenarioOrchestratorStore = create<ScenarioOrchestratorState>((set, get) => ({
  chaosLevel: 0,
  performance: { uptime: 99.99, speedupVsStatic: 3.2, consensusOptimality: 0.92 },

  setChaosLevel: (level) => {
    const p = get().performance;
    const uptime = level >= 2 ? 98.7 : level === 1 ? 99.5 : 99.99;
    set({ chaosLevel: level, performance: { ...p, uptime } });
  },

  bumpPerformanceDemo: () => {
    const p = get().performance;
    set({
      performance: {
        uptime: p.uptime,
        speedupVsStatic: Math.min(4.2, p.speedupVsStatic + 0.05),
        consensusOptimality: Math.min(0.98, p.consensusOptimality + 0.002),
      },
    });
  },
}));
