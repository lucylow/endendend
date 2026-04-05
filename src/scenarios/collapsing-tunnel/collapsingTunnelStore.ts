import { create } from "zustand";
import type { Agent } from "@/types";

export type TunnelRescueRole = "relay" | "rescue_lead" | "support";

export interface TunnelSimAgent extends Agent {
  trapped: boolean;
  heartbeatLost: boolean;
  velocity: { x: number; z: number };
  tunnelRescueRole?: TunnelRescueRole;
}

function unit(id: string, name: string, z: number, role: Agent["role"], trappedZone: boolean): TunnelSimAgent {
  const x = (parseInt(id.replace(/\D/g, ""), 10) % 5) * 1.4 - 2.8;
  return {
    id,
    name,
    role,
    position: { x, y: 0.75, z },
    battery: role === "explorer" ? 86 : 72,
    status: "active",
    trajectory: [],
    color: trappedZone ? "#64748b" : role === "explorer" ? "#38bdf8" : "#a78bfa",
    latency: 20,
    tasksCompleted: 0,
    stakeAmount: 280 + (Math.abs(z) % 5) * 90,
    currentBehavior: role === "explorer" ? "exploring" : "relaying",
    assignedCell: null,
    targetId: null,
    isByzantine: false,
    trapped: false,
    heartbeatLost: false,
    velocity: { x: 0, z: 0 },
  };
}

function initialFormation(): TunnelSimAgent[] {
  return [
    unit("tunnel-1", "Lead", 6, "explorer", false),
    unit("tunnel-2", "Relay-A", -4, "relay", false),
    unit("tunnel-3", "Relay-B", -14, "relay", false),
    unit("tunnel-4", "Relay-C", -24, "relay", false),
    unit("tunnel-5", "Tail-A", -34, "relay", true),
    unit("tunnel-6", "Tail-B", -38, "standby", true),
    unit("tunnel-7", "Tail-C", -42, "standby", true),
    unit("tunnel-8", "Anchor", -46, "relay", true),
  ];
}

export interface CollapsingTunnelState {
  agents: TunnelSimAgent[];
  collapseTriggered: boolean;
  rescueComplete: boolean;
  rescueSpeedup: number;
  beaconSent: boolean;
  manualBaselineS: number;
  tashiRescueS: number | null;
  collapseTime: number | null;
  simRunning: boolean;
  session: number;
  reset: () => void;
  setSimRunning: (v: boolean) => void;
  setAgents: (agents: TunnelSimAgent[]) => void;
  triggerCollapse: () => void;
}

export const useCollapsingTunnelStore = create<CollapsingTunnelState>((set, get) => ({
  agents: initialFormation(),
  collapseTriggered: false,
  rescueComplete: false,
  rescueSpeedup: 2.1,
  beaconSent: false,
  manualBaselineS: 48,
  tashiRescueS: null,
  collapseTime: null,
  simRunning: true,
  session: 0,

  reset: () =>
    set((s) => ({
      agents: initialFormation(),
      collapseTriggered: false,
      rescueComplete: false,
      beaconSent: false,
      tashiRescueS: null,
      collapseTime: null,
      session: s.session + 1,
    })),

  setSimRunning: (v) => set({ simRunning: v }),

  setAgents: (agents) => set({ agents }),

  triggerCollapse: () => {
    const s = get();
    if (s.collapseTriggered) return;
    const t0 = performance.now() / 1000;
    const next = s.agents.map((a) => {
      if (a.position.z < -35) {
        return {
          ...a,
          trapped: true,
          status: "offline" as const,
          heartbeatLost: true,
          currentBehavior: "idle" as const,
          color: "#475569",
          tunnelRescueRole: undefined,
        };
      }
      return { ...a };
    });
    set({
      collapseTriggered: true,
      collapseTime: t0,
      agents: next,
      beaconSent: false,
      rescueComplete: false,
      tashiRescueS: null,
    });
  },
}));
