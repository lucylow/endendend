import { create } from "zustand";

export type VictimRescueRole = "converge" | "relay" | "search";

export interface VictimScenarioAgent {
  id: string;
  position: { x: number; z: number };
  stake: number;
  victimDetected: boolean;
  rescueRole: VictimRescueRole;
}

export interface HandoffAgent {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
}

interface ScenarioVizState {
  victimAgents: VictimScenarioAgent[];
  missionComplete: boolean;
  /** Tashi vs static rescue narrative (seconds). */
  scenarioStats: { speedup: number; tashiSeconds: number; staticSeconds: number };

  agentsA: HandoffAgent[];
  agentsB: HandoffAgent[];
  handoffActive: boolean;
  handoffTimeMs: number;
  consensusLatencyMs: number;
  zeroDowntime: boolean;
  /** Incremented on init so Swarm A can reset one-shot detection. */
  handoffSession: number;

  initVictimPriority: () => void;
  resetVictimPriority: () => void;
  setVictimAgents: (agents: VictimScenarioAgent[]) => void;
  setMissionComplete: (v: boolean) => void;

  initMultiSwarmHandoff: () => void;
  resetMultiSwarmHandoff: () => void;
  setAgentsA: (agents: HandoffAgent[]) => void;
  setAgentsB: (agents: HandoffAgent[]) => void;
  triggerHandoff: () => void;
}

const ROVER_IDS = ["rover-A", "rover-B", "rover-C", "rover-D", "rover-E", "rover-F"] as const;

function initialVictimAgents(): VictimScenarioAgent[] {
  const stakes = [0.95, 0.72, 0.55, 0.68, 0.42, 0.38];
  const positions: { x: number; z: number }[] = [
    { x: 10, z: 8 },
    { x: -4, z: 14 },
    { x: -9, z: 3 },
    { x: 6, z: -10 },
    { x: -14, z: -6 },
    { x: 2, z: -12 },
  ];
  return ROVER_IDS.map((id, i) => ({
    id,
    position: positions[i] ?? { x: 0, z: 0 },
    stake: stakes[i] ?? 0.5,
    victimDetected: false,
    rescueRole: "search",
  }));
}

function initialAgentsA(): HandoffAgent[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `A-${i}`,
    position: { x: -35 + (i % 2) * 4, y: 1, z: 25 + Math.floor(i / 2) * 4 },
    velocity: { x: 0, y: 0, z: 0 },
  }));
}

function initialAgentsB(): HandoffAgent[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `B-${i}`,
    position: {
      x: 35 + Math.cos(i * 1.2) * 7,
      y: 1.5,
      z: -25 + Math.sin(i * 1.2) * 7,
    },
    velocity: { x: 0, y: 0, z: 0 },
  }));
}

export const useScenarioVizStore = create<ScenarioVizState>((set) => ({
  victimAgents: [],
  missionComplete: false,
  scenarioStats: { speedup: 23, tashiSeconds: 23, staticSeconds: 46 },

  agentsA: [],
  agentsB: [],
  handoffActive: false,
  handoffTimeMs: 0,
  consensusLatencyMs: 0,
  zeroDowntime: false,
  handoffSession: 0,

  initVictimPriority: () =>
    set({
      victimAgents: initialVictimAgents(),
      missionComplete: false,
      scenarioStats: { speedup: 23, tashiSeconds: 23, staticSeconds: 46 },
    }),

  resetVictimPriority: () =>
    set({
      victimAgents: [],
      missionComplete: false,
    }),

  setVictimAgents: (agents) => set({ victimAgents: agents }),
  setMissionComplete: (v) => set({ missionComplete: v }),

  initMultiSwarmHandoff: () =>
    set((s) => ({
      agentsA: initialAgentsA(),
      agentsB: initialAgentsB(),
      handoffActive: false,
      handoffTimeMs: 0,
      consensusLatencyMs: 0,
      zeroDowntime: false,
      handoffSession: s.handoffSession + 1,
    })),

  resetMultiSwarmHandoff: () =>
    set((s) => ({
      agentsA: [],
      agentsB: [],
      handoffActive: false,
      handoffTimeMs: 0,
      consensusLatencyMs: 0,
      zeroDowntime: false,
      handoffSession: s.handoffSession + 1,
    })),

  setAgentsA: (agents) => set({ agentsA: agents }),
  setAgentsB: (agents) => set({ agentsB: agents }),

  triggerHandoff: () => {
    set({
      handoffActive: true,
      handoffTimeMs: 18,
      consensusLatencyMs: 18,
      zeroDowntime: true,
    });
  },
}));

export function resetScenarioVizForSlug(slug: string) {
  const s = useScenarioVizStore.getState();
  if (slug === "victim-priority") {
    s.resetMultiSwarmHandoff();
    s.initVictimPriority();
    return;
  }
  if (slug === "multi-swarm-handoff") {
    s.resetVictimPriority();
    s.initMultiSwarmHandoff();
    return;
  }
  s.resetVictimPriority();
  s.resetMultiSwarmHandoff();
}
