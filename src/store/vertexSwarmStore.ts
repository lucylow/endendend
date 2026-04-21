import { create } from "zustand";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { VertexSwarmSimulator, type VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";
import { vertexSimEventToRuntime, type SwarmRuntimeEvent } from "@/swarm/swarmEventStream";

export type VertexSwarmStoreState = {
  simulator: VertexSwarmSimulator | null;
  view: VertexSwarmView | null;
  isRunning: boolean;
  scenario: MissionScenarioKind;
  seed: number;
  agentCount: number;
  useMockFallback: boolean;
  /** Wall-clock multiplier vs simulator base tick (higher = faster). */
  simSpeed: number;
  lastError: string | null;
  eventLog: { at: number; message: string }[];
  /** Structured P2P / mesh timeline for replay-oriented dashboards. */
  runtimeEvents: SwarmRuntimeEvent[];
  tickLoop: ReturnType<typeof setInterval> | null;
  /** Bus subscription cleanup while the sim loop is running */
  busUnsub: null | (() => void);
  initSimulator: () => void;
  setScenario: (s: MissionScenarioKind) => void;
  setSeed: (n: number) => void;
  setAgentCount: (n: number) => void;
  setUseMockFallback: (v: boolean) => void;
  setSimSpeed: (v: number) => void;
  start: () => void;
  pause: () => void;
  stepOnce: () => Promise<void>;
  reset: () => Promise<void>;
  pushLog: (message: string) => void;
  triggerBlackout: () => Promise<void>;
  recoverBlackout: () => Promise<void>;
  forceDropout: (nodeId: string) => void;
  injectTarget: (nodeId: string) => Promise<void>;
  forceRoleHandoff: (nodeId: string) => Promise<void>;
  meshInjectPacketLoss: (delta01: number) => void;
  meshInjectLatency: (deltaMs: number) => void;
  meshTogglePartition: (active: boolean) => void;
  meshResetStress: () => void;
  snapshotFoxMap: () => void;
  replayFoxMapHistory: () => void;
  stampFoxMapCell: (gx: number, gz: number) => void;
  recoverFoxMapNode: (nodeId: string) => Promise<void>;
};

const MAX_LOG = 200;
const MAX_RUNTIME_EVENTS = 400;

export const useVertexSwarmStore = create<VertexSwarmStoreState>((set, get) => ({
  simulator: null,
  view: null,
  isRunning: false,
  scenario: "collapsed_building",
  seed: 42,
  agentCount: 5,
  useMockFallback: true,
  simSpeed: 1,
  lastError: null,
  eventLog: [],
  runtimeEvents: [],
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
    cfg.useMockFallback = get().useMockFallback;
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
    get().simulator?.setUseMockFallback(v);
  },

  setSimSpeed(v) {
    const clamped = Math.max(0.25, Math.min(4, v));
    const wasRunning = get().isRunning;
    if (wasRunning) get().pause();
    set({ simSpeed: clamped });
    if (wasRunning) get().start();
  },

  start() {
    const st = get();
    st.busUnsub?.();
    if (st.tickLoop) clearInterval(st.tickLoop);
    if (!st.simulator) st.initSimulator();
    const sim = get().simulator;
    if (!sim) return;
    const busUnsub = sim.bus.subscribe((ev) => {
      const mapped = vertexSimEventToRuntime(ev, Date.now());
      if (mapped) {
        set((s) => ({ runtimeEvents: [mapped, ...s.runtimeEvents].slice(0, MAX_RUNTIME_EVENTS) }));
      }
      if (ev.type === "ledger_committed") get().pushLog(`${ev.eventType} → ${ev.eventHash.slice(0, 10)}…`);
      if (ev.type === "task_assigned") get().pushLog(`Assigned ${ev.taskId} → ${ev.nodeId}`);
      if (ev.type === "blackout") get().pushLog(ev.active ? `Blackout (${ev.severity ?? "?"})` : "Mesh recovered");
      if (ev.type === "map_updated")
        get().pushLog(`Map cov ${(ev.coverage01 * 100).toFixed(0)}% · frontier ${ev.frontier}`);
      if (ev.type === "target_candidate") get().pushLog(`Target candidate ${ev.candidateId} (${(ev.confidence01 * 100).toFixed(0)}%)`);
      if (ev.type === "target_confirmed_bus") get().pushLog(`Target confirmed ${ev.candidateId}`);
      if (ev.type === "role_handoff") get().pushLog(`Role ${ev.nodeId} → ${ev.toRole} (${ev.reason})`);
    });
    const period = Math.max(16, Math.floor(sim.tickMs / get().simSpeed));
    const loop = setInterval(() => {
      void (async () => {
        try {
          const v = await sim.tick();
          set({ view: v, lastError: null });
        } catch (e) {
          set({ lastError: e instanceof Error ? e.message : String(e) });
        }
      })();
    }, period);
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
    set({ view: null, eventLog: [], runtimeEvents: [] });
    await get().stepOnce();
  },

  async triggerBlackout() {
    if (!get().simulator) get().initSimulator();
    const sim = get().simulator;
    if (sim) await sim.forceBlackout(12_000, "partial");
    await get().stepOnce();
  },

  async recoverBlackout() {
    const sim = get().simulator;
    if (sim) await sim.recoverMesh();
    await get().stepOnce();
  },

  forceDropout(nodeId: string) {
    get().simulator?.forceNodeDropout(nodeId);
    void get().stepOnce();
  },

  async injectTarget(nodeId: string) {
    if (!get().simulator) get().initSimulator();
    const sim = get().simulator;
    if (!sim) return;
    await sim.injectTargetNear(nodeId);
    await get().stepOnce();
  },

  async forceRoleHandoff(nodeId: string) {
    if (!get().simulator) get().initSimulator();
    const sim = get().simulator;
    if (!sim) return;
    await sim.forceRoleHandoff(nodeId);
    await get().stepOnce();
  },

  meshInjectPacketLoss(delta01) {
    get().simulator?.meshInjectPacketLoss(delta01);
    void get().stepOnce();
  },

  meshInjectLatency(deltaMs) {
    get().simulator?.meshInjectLatency(deltaMs);
    void get().stepOnce();
  },

  meshTogglePartition(active) {
    get().simulator?.meshTogglePartition(active);
    void get().stepOnce();
  },

  meshResetStress() {
    get().simulator?.meshResetStress();
    void get().stepOnce();
  },

  snapshotFoxMap() {
    get().simulator?.snapshotFoxMapLedger();
    void get().stepOnce();
  },

  replayFoxMapHistory() {
    get().simulator?.replayFoxmqLedger();
    void get().stepOnce();
  },

  stampFoxMapCell(gx: number, gz: number) {
    get().simulator?.operatorStampCell(gx, gz);
    void get().stepOnce();
  },

  async recoverFoxMapNode(nodeId: string) {
    const sim = get().simulator ?? (get().initSimulator(), get().simulator);
    if (sim) await sim.forceNodeRecovery(nodeId);
    await get().stepOnce();
  },
}));

void useVertexSwarmStore.getState().initSimulator();
void useVertexSwarmStore.getState().stepOnce();
