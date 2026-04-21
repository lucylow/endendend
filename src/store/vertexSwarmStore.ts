import { create } from "zustand";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { VertexSwarmSimulator, type VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";

export type VertexSwarmStoreState = {
  simulator: VertexSwarmSimulator | null;
  view: VertexSwarmView | null;
  isRunning: boolean;
  scenario: MissionScenarioKind;
  seed: number;
  agentCount: number;
  useMockFallback: boolean;
  lastError: string | null;
  eventLog: { at: number; message: string }[];
  tickLoop: ReturnType<typeof setInterval> | null;
  /** Bus subscription cleanup while the sim loop is running */
  busUnsub: null | (() => void);
  initSimulator: () => void;
  setScenario: (s: MissionScenarioKind) => void;
  setSeed: (n: number) => void;
  setAgentCount: (n: number) => void;
  setUseMockFallback: (v: boolean) => void;
  start: () => void;
  pause: () => void;
  stepOnce: () => Promise<void>;
  reset: () => Promise<void>;
  pushLog: (message: string) => void;
};

const MAX_LOG = 200;

export const useVertexSwarmStore = create<VertexSwarmStoreState>((set, get) => ({
  simulator: null,
  view: null,
  isRunning: false,
  scenario: "collapsed_building",
  seed: 42,
  agentCount: 5,
  useMockFallback: true,
  lastError: null,
  eventLog: [],
  tickLoop: null,
  busUnsub: null,

  pushLog(message: string) {
    const at = Date.now();
    set((s) => ({ eventLog: [{ at, message }, ...s.eventLog].slice(0, MAX_LOG) }));
  },

  initSimulator() {
    const { scenario, seed, agentCount } = get();
    const mid = `vertex2-${scenario}-${seed}`;
    const cfg = defaultRuntimeConfig(scenario, seed);
    cfg.tickMs = 400;
    const sim = new VertexSwarmSimulator(mid, cfg, agentCount);
    set({ simulator: sim, lastError: null });
  },

  setScenario(s) {
    set({ scenario: s });
    get().initSimulator();
  },

  setSeed(n) {
    set({ seed: n });
    get().initSimulator();
  },

  setAgentCount(n) {
    set({ agentCount: Math.max(5, Math.min(12, n)) });
    get().initSimulator();
  },

  setUseMockFallback(v) {
    set({ useMockFallback: v });
  },

  start() {
    const st = get();
    st.busUnsub?.();
    if (st.tickLoop) clearInterval(st.tickLoop);
    if (!st.simulator) st.initSimulator();
    const sim = get().simulator;
    if (!sim) return;
    const busUnsub = sim.bus.subscribe((ev) => {
      if (ev.type === "ledger_committed") get().pushLog(`${ev.eventType} → ${ev.eventHash.slice(0, 10)}…`);
      if (ev.type === "task_assigned") get().pushLog(`Assigned ${ev.taskId} → ${ev.nodeId}`);
      if (ev.type === "blackout") get().pushLog(ev.active ? `Blackout (${ev.severity ?? "?"})` : "Mesh recovered");
    });
    const loop = setInterval(() => {
      void (async () => {
        try {
          const v = await sim.tick();
          set({ view: v, lastError: null });
        } catch (e) {
          set({ lastError: e instanceof Error ? e.message : String(e) });
        }
      })();
    }, sim.tickMs);
    set({ isRunning: true, tickLoop: loop, busUnsub });
  },

  pause() {
    const t = get().tickLoop;
    const u = get().busUnsub;
    if (t) clearInterval(t);
    u?.();
    set({ isRunning: false, tickLoop: null, busUnsub: null });
  },

  async stepOnce() {
    const sim = get().simulator ?? (get().initSimulator(), get().simulator);
    if (!sim) return;
    try {
      const v = await sim.tick();
      set({ view: v, lastError: null });
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) });
    }
  },

  async reset() {
    get().pause();
    get().initSimulator();
    set({ view: null, eventLog: [] });
    await get().stepOnce();
  },
}));

void useVertexSwarmStore.getState().initSimulator();
void useVertexSwarmStore.getState().stepOnce();
