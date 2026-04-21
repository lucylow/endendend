import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createMockAdapter, engineSnapshotToTrack2Mock } from "./mockAdapter";
import { MissionReplay } from "./replay";
import type { EngineSnapshot, ScenarioVariantId } from "./types";
import { useSwarmStore } from "@/stores/swarmStore";

export type MockTransport = "mock" | "live";

export interface DynamicDaisyChainStoreState {
  transport: MockTransport;
  running: boolean;
  speed: number;
  seed: number;
  variant: ScenarioVariantId["id"];
  snapshot: EngineSnapshot | null;
  replay: MissionReplay;
  replayMode: boolean;
  replayIndex: number;
  /** When true, mock tick pushes into Track2 swarm store (Webots-shaped fields). */
  bridgeTrack2: boolean;
  lastError: string | null;
}

type Actions = {
  setTransport: (t: MockTransport) => void;
  setRunning: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setSeed: (v: number) => void;
  setVariant: (v: ScenarioVariantId["id"]) => void;
  setBridgeTrack2: (v: boolean) => void;
  tick: (dt: number) => void;
  resetMission: () => void;
  forceDegrade: () => void;
  forceRelayPromote: () => void;
  dropRelay: (nodeId: string) => void;
  triggerRecovery: () => void;
  setReplayMode: (v: boolean) => void;
  setReplayIndex: (i: number) => void;
  scrubReplay: (t: number) => void;
};

let raf = 0;
let lastTs = 0;

export const useDynamicDaisyChainStore = create<DynamicDaisyChainStoreState & Actions>()(
  subscribeWithSelector((set, get) => {
    const adapter = createMockAdapter(42, "default");

    const pushBridge = (snap: EngineSnapshot) => {
      if (!get().bridgeTrack2) return;
      const { wsConnected } = useSwarmStore.getState();
      if (wsConnected && get().transport === "live") return;
      useSwarmStore.getState().ingestMockFrame(engineSnapshotToTrack2Mock(snap));
    };

    const stepEngine = (dt: number) => {
      const { running, replayMode } = get();
      if (!running || replayMode) return;
      const { snapshot } = adapter.step(dt);
      get().replay.record(snapshot);
      set({ snapshot, lastError: null });
      pushBridge(snapshot);
    };

    return {
      transport: "mock",
      running: false,
      speed: 1,
      seed: 42,
      variant: "default" as ScenarioVariantId["id"],
      snapshot: null,
      replay: new MissionReplay(),
      replayMode: false,
      replayIndex: 0,
      bridgeTrack2: true,
      lastError: null,

      setTransport: (transport) => set({ transport }),

      setRunning: (running) => {
        set({ running });
        if (running) {
          if (!get().snapshot) {
            stepEngine(0.02);
          }
          cancelAnimationFrame(raf);
          lastTs = performance.now() / 1000;
          const loop = (now: number) => {
            const t = now / 1000;
            const dt = Math.min(0.12, Math.max(0, t - lastTs)) * get().speed;
            lastTs = t;
            stepEngine(dt);
            if (get().running && !get().replayMode) raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
        }
      },

      setSpeed: (speed) => set({ speed: Math.max(0.1, speed) }),

      setSeed: (seed) => {
        set({ seed });
        adapter.reset(seed, get().variant);
        get().replay.clear();
        set({ snapshot: null, replayIndex: 0 });
      },

      setVariant: (variant) => {
        set({ variant });
        adapter.reset(get().seed, variant);
        get().replay.clear();
        set({ snapshot: null, replayIndex: 0 });
      },

      setBridgeTrack2: (bridgeTrack2) => set({ bridgeTrack2 }),

      tick: (dt) => stepEngine(dt),

      resetMission: () => {
        const { seed, variant } = get();
        adapter.reset(seed, variant);
        get().replay.clear();
        set({ snapshot: null, replayIndex: 0, replayMode: false, lastError: null });
      },

      forceDegrade: () => {
        const snap = get().snapshot;
        if (!snap) return;
        set({
          snapshot: {
            ...snap,
            phase: "intermittent",
            events: [
              ...snap.events,
              {
                id: `manual_${Date.now()}`,
                t: snap.t,
                type: "signal_degrade",
                message: "Operator forced RF degradation",
                nodeIds: [],
              },
            ],
          },
        });
      },

      forceRelayPromote: () => {
        const snap = get().snapshot;
        if (!snap?.nodes.length) return;
        const standby = snap.nodes.find((n) => !n.isRelay && n.role !== "lead_explorer");
        if (!standby) return;
        const nid = standby.profile.id;
        const nodes = snap.nodes.map((n) =>
          n.profile.id === nid
            ? { ...n, isRelay: true, relayFrozen: true, relayHoldS: n.s, role: "relay" as const, localTask: "relay_hold" }
            : n,
        );
        const next: EngineSnapshot = {
          ...snap,
          nodes,
          events: [
            ...snap.events,
            {
              id: `manual_${Date.now()}`,
              t: snap.t,
              type: "relay_activated",
              message: "Operator forced relay promotion",
              nodeIds: [nid],
            },
          ],
        };
        set({ snapshot: next });
        pushBridge(next);
      },

      dropRelay: (nodeId) => {
        const snap = get().snapshot;
        if (!snap) return;
        const nodes = snap.nodes.map((n) =>
          n.profile.id === nodeId
            ? { ...n, isRelay: false, relayFrozen: false, relayHoldS: null, role: "standby" as const, connectivity: "offline" as const }
            : n,
        );
        const next: EngineSnapshot = { ...snap, nodes, phase: "recovering" };
        set({ snapshot: next });
        pushBridge(next);
      },

      triggerRecovery: () => {
        const snap = get().snapshot;
        if (!snap) return;
        const next: EngineSnapshot = {
          ...snap,
          phase: "recovering",
          nodes: snap.nodes.map((n) =>
            n.connectivity === "offline" ? { ...n, connectivity: "degraded" as const } : n,
          ),
          events: [
            ...snap.events,
            {
              id: `manual_${Date.now()}`,
              t: snap.t,
              type: "recovery_sync",
              message: "Operator triggered recovery sync",
              nodeIds: snap.nodes.map((n) => n.profile.id),
            },
          ],
        };
        set({ snapshot: next });
        pushBridge(next);
      },

      setReplayMode: (replayMode) => {
        set({ replayMode, running: false });
        cancelAnimationFrame(raf);
      },

      setReplayIndex: (replayIndex) => {
        const f = get().replay.atIndex(replayIndex);
        if (f) {
          set({ replayIndex, snapshot: f.snapshot });
          pushBridge(f.snapshot);
        }
      },

      scrubReplay: (t) => {
        const i = get().replay.indexAtOrBefore(t);
        const f = get().replay.atIndex(i);
        if (!f) return;
        set({ replayIndex: i, snapshot: f.snapshot });
        pushBridge(f.snapshot);
      },
    };
  }),
);
