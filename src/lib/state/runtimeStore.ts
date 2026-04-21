import { create } from "zustand";
import type { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import type { SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";
import { IntegrationHttpClient, logIntegrationError } from "@/lib/api/client";
import { SwarmRealtimeCoordinator, type RealtimeStatus } from "@/lib/api/realtime";
import { createDemoSwarmBackendSnapshot } from "@/lib/integration/demoSwarmBackend";
import { isSwarmGatewayDemoFallbackEnabled } from "@/lib/integration/swarmGatewayResilience";
import { createFallbackFlatEnvelope, createFallbackMap } from "@/lib/api/fallback";
import { LocalMissionRuntime } from "@/lib/runtime/localMissionRuntime";
import {
  mergeSwarmSnapshotHints,
  normalizeBackendEnvelopeToFlat,
  rewardsFromEnvelope,
  settlementPreviewFromEnvelope,
  tasksFromEnvelope,
} from "@/lib/state/normalizers";
import { runSettlementSeal } from "@/lib/settlement/settlementService";
import {
  buildDemoWalletView,
  buildDisconnectedView,
  clearWalletSession,
  loadWalletSession,
  saveWalletSession,
} from "@/lib/wallet/walletService";
import { mockSignPayload } from "@/lib/wallet/mockWallet";
import { clearCheckpoint } from "@/lib/mission/checkpoints";
import { useWalletStore } from "@/wallet/walletStore";
import type {
  ConnectionHealth,
  FlatMissionEnvelope,
  MapViewModel,
  RewardLineViewModel,
  RuntimeEventEntry,
  SettlementPreviewViewModel,
  SimulationAugmentation,
  TaskViewModel,
  TransportMode,
  WalletSessionViewModel,
} from "./types";
import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { attachSimulation } from "@/mock/fallbackAdapter";
import { ScenarioSimulationRuntime } from "@/mock/scenarioRuntime";
import { mockOpenTasks } from "@/mock/taskFactory";
import { mockRewardLines } from "@/mock/rewardFactory";

function evId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type RuntimeState = {
  scenarioKey: ScenarioKey;
  transport: TransportMode;
  demoWalletPreferred: boolean;
  operatorActorId: string;

  localRuntime: LocalMissionRuntime | null;
  fullEnvelope: TashiStateEnvelope | null;
  flatEnvelope: FlatMissionEnvelope;
  tasks: TaskViewModel[];
  rewards: RewardLineViewModel[];
  mapModel: MapViewModel;
  settlementPreview: SettlementPreviewViewModel | null;
  wallet: WalletSessionViewModel;

  connection: ConnectionHealth & { realtimeStatus: RealtimeStatus };
  lastSwarmSnapshot: SwarmBackendSnapshot | null;
  eventLog: RuntimeEventEntry[];

  loading: boolean;
  lastActionError: string | null;

  realtime: SwarmRealtimeCoordinator | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;

  /** Deterministic mesh + sensor simulator (always available in workspace). */
  missionSimulation: ScenarioSimulationRuntime | null;
  simulationAug: SimulationAugmentation | null;
  mockSimulationEnabled: boolean;

  pushEvent: (kind: string, message: string, source: RuntimeEventEntry["source"], payload?: Record<string, unknown>) => void;
  refreshFromLocal: () => void;
  initWorkspace: (scenario: ScenarioKey) => Promise<void>;
  setScenario: (scenario: ScenarioKey) => Promise<void>;
  shutdownRealtime: () => void;

  advancePhase: () => Promise<void>;
  addTarget: (targetId: string) => Promise<void>;
  assignTask: () => Promise<void>;
  saveCheckpoint: (label: string) => Promise<void>;
  sealSettlement: () => Promise<void>;

  enableDemoWallet: () => void;
  applyLiveWallet: (address: string | null, chainId: number | null, status: WalletSessionViewModel["status"]) => void;
  signMockReadiness: (label: string) => void;
  fastForwardDemo: () => Promise<void>;

  setMockSimulationEnabled: (on: boolean) => void;
  toggleMeshPartition: () => void;
  forceMockNodeDrop: (nodeId: string) => void;
  injectMockTarget: () => void;
  injectMockSensorSpike: (nodeId: string) => void;
  setMockSimulationPaused: (paused: boolean) => void;
  setMockSimulationSpeed: (speed: number) => void;
  replayMockEvents: (n: number) => void;
};

function defaultConnection(): ConnectionHealth & { realtimeStatus: RealtimeStatus } {
  return {
    httpReachable: false,
    wsConnected: false,
    pollActive: false,
    lastSyncAtMs: null,
    lastError: null,
    reconnectAttempt: 0,
    realtimeStatus: "idle",
  };
}

export const useRuntimeStore = create<RuntimeState>((set, get) => ({
  scenarioKey: "collapsed_building",
  transport: "local_engine",
  demoWalletPreferred: false,
  operatorActorId: "operator-ui",

  localRuntime: null,
  fullEnvelope: null,
  flatEnvelope: createFallbackFlatEnvelope("collapsed_building", "boot", "boot"),
  tasks: [],
  rewards: [],
  mapModel: createFallbackMap("boot", 0),
  settlementPreview: null,
  wallet: buildDisconnectedView(),

  connection: defaultConnection(),
  lastSwarmSnapshot: null,
  eventLog: [],

  loading: false,
  lastActionError: null,

  realtime: null,
  heartbeatTimer: null,

  missionSimulation: null,
  simulationAug: null,
  mockSimulationEnabled: true,

  pushEvent: (kind, message, source, payload) => {
    set((s) => ({
      eventLog: [
        ...s.eventLog.slice(-199),
        { id: evId(), ts: Date.now(), kind, message, source, payload },
      ],
    }));
  },

  refreshFromLocal: () => {
    const rt = get().localRuntime;
    if (!rt) return;

    const aug = get().simulationAug;
    const preferLive = get().connection.httpReachable && get().transport === "hybrid";
    const simOn = get().mockSimulationEnabled;

    const env = rt.buildEnvelope();
    let flat = normalizeBackendEnvelopeToFlat(env, "local_engine", rt.registry, Date.now());
    if (aug && simOn) {
      flat = attachSimulation(flat, aug, preferLive);
      const bonus = Math.min(28, Math.floor(aug.mapExploredBoost / 3));
      flat = {
        ...flat,
        mapSummary: {
          ...flat.mapSummary,
          exploredCells: flat.mapSummary.exploredCells + bonus,
          coveragePercent: Math.min(99, flat.mapSummary.coveragePercent + Math.min(4, Math.floor(bonus / 6))),
        },
      };
    }
    const tasks = tasksFromEnvelope(env, "local_engine");
    const rewards = rewardsFromEnvelope(env, "local_engine");
    const walletAddr = get().wallet.address ?? undefined;
    const settlement = settlementPreviewFromEnvelope(env, walletAddr, "local_engine");
    const mapModel = createFallbackMap(flat.missionId, flat.mapSummary.exploredCells);
    set({
      fullEnvelope: env,
      flatEnvelope: { ...flat, scenario: env.mission.scenario ?? get().scenarioKey },
      tasks,
      rewards,
      settlementPreview: settlement,
      mapModel: { ...mapModel, source: "local_engine" },
    });
  },

  shutdownRealtime: () => {
    const { realtime, heartbeatTimer } = get();
    realtime?.stop();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    set({
      realtime: null,
      heartbeatTimer: null,
      missionSimulation: null,
      simulationAug: null,
      localRuntime: null,
      connection: {
        ...get().connection,
        realtimeStatus: "idle",
        pollActive: false,
        wsConnected: false,
      },
    });
  },

  initWorkspace: async (scenario) => {
    get().shutdownRealtime();
    set({ loading: true, lastActionError: null, scenarioKey: scenario });

    const globalWallet = useWalletStore.getState();
    if (globalWallet.mode === "mock" && globalWallet.account) {
      const a = globalWallet.account;
      set({
        demoWalletPreferred: true,
        wallet: {
          status: "demo",
          address: a.address,
          chainId: a.chainId ?? null,
          label: `${a.displayName} (global mock)`,
          source: "mock",
        },
        operatorActorId: a.address,
      });
    } else if (globalWallet.mode === "real" && globalWallet.account) {
      const a = globalWallet.account;
      set({
        demoWalletPreferred: false,
        wallet: {
          status: "connected",
          address: a.address,
          chainId: a.chainId,
          label: a.displayName,
          source: "live",
        },
        operatorActorId: a.address,
      });
    } else {
      const persisted = loadWalletSession();
      if (persisted?.mode === "demo" && persisted.address) {
        set({
          demoWalletPreferred: true,
          wallet: {
            status: "demo",
            address: persisted.address,
            chainId: persisted.chainId,
            label: "Demo signer (restored)",
            source: "restored",
          },
          operatorActorId: persisted.address,
        });
      }
    }

    const http = IntegrationHttpClient.fromEnv();
    let httpOk = false;
    if (http) {
      try {
        await http.health();
        httpOk = true;
        set((s) => ({
          connection: { ...s.connection, httpReachable: true, lastError: null },
        }));
        get().pushEvent("backend", "HTTP mesh gateway reachable", "live_http");
      } catch (e) {
        logIntegrationError("health", e);
        set((s) => ({
          connection: { ...s.connection, httpReachable: false, lastError: e instanceof Error ? e.message : "health_failed" },
        }));
      }
    }

    let rt: LocalMissionRuntime | null = LocalMissionRuntime.tryRestoreSession(scenario);
    try {
      if (!rt) {
        rt = await LocalMissionRuntime.bootstrap(scenario, get().operatorActorId);
        get().pushEvent("mission", `Bootstrapped ${rt.missionId}`, "local_engine");
      } else {
        get().pushEvent("mission", `Restored checkpoint ${rt.missionId}`, "restored");
      }
    } catch (e) {
      logIntegrationError("local_bootstrap", e);
      get().pushEvent("mission", "Local engine bootstrap failed — mock fallback", "mock");
      const missionId = `mock-${scenario}-${Date.now().toString(36)}`;
      const flatBase = ScenarioSimulationRuntime.buildStandaloneEnvelope(scenario as MissionScenarioKind, missionId, "fallback");
      const seed = `${get().operatorActorId}|${missionId}`;
      const sim = new ScenarioSimulationRuntime({
        seed,
        missionId,
        scenario: scenario as MissionScenarioKind,
        telemetrySource: "fallback",
      });
      const aug = sim.tick(Date.now(), flatBase.phase, "fallback");
      const flat = attachSimulation(flatBase, aug, false);
      const { tasks, rewards, map } = ScenarioSimulationRuntime.standaloneTasksRewards(scenario as MissionScenarioKind, missionId, seed);
      set({
        localRuntime: null,
        transport: "fallback_mock",
        fullEnvelope: null,
        missionSimulation: sim,
        simulationAug: aug,
        flatEnvelope: flat,
        tasks,
        rewards,
        mapModel: { ...map, source: "fallback" },
        settlementPreview: {
          ready: false,
          manifestHash: "mock",
          mockLabeled: true,
          source: "mock",
        },
        loading: false,
      });
      return;
    }

    const simSeed = `${get().operatorActorId}|${rt.missionId}|${scenario}`;
    const missionSim = ScenarioSimulationRuntime.forLocalRuntime(rt, simSeed);

    set({
      localRuntime: rt,
      transport: httpOk ? "hybrid" : "local_engine",
      demoWalletPreferred: get().demoWalletPreferred,
      missionSimulation: missionSim,
      simulationAug: null,
    });
    if (get().mockSimulationEnabled) {
      const env0 = rt.buildEnvelope();
      const a0 = missionSim.tick(
        Date.now(),
        env0.mission.phase,
        httpOk ? "live_http" : "local_engine",
      );
      set({ simulationAug: a0 });
    }
    get().refreshFromLocal();

    if (httpOk && http) {
      const pollDemo = isSwarmGatewayDemoFallbackEnabled() ? () => createDemoSwarmBackendSnapshot() : undefined;
      const coord = new SwarmRealtimeCoordinator(
        http,
        {
          onSnapshot: (snap) => {
            set((s) => ({
              lastSwarmSnapshot: snap,
              connection: {
                ...s.connection,
                lastSyncAtMs: snap.ts_ms,
                wsConnected: s.connection.realtimeStatus === "ws_open",
              },
            }));
            const augSnap = get().simulationAug;
            if (augSnap && get().mockSimulationEnabled) {
              const merged = mergeSwarmSnapshotHints(snap, get().flatEnvelope);
              const preferLive = true;
              set({
                flatEnvelope: attachSimulation(merged, augSnap, preferLive),
              });
            }
            get().pushEvent("mesh", `Snapshot ${snap.ts_ms} (${snap.missions?.length ?? 0} missions)`, "live_http", {
              ts: snap.ts_ms,
            });
          },
          onStatus: (st) => {
            set((s) => ({
              connection: {
                ...s.connection,
                realtimeStatus: st,
                pollActive: st === "poll",
                wsConnected: st === "ws_open",
              },
            }));
          },
          onWsDrop: () => get().pushEvent("mesh", "WebSocket dropped — polling / retry", "live_http"),
        },
        6000,
        pollDemo,
      );
      coord.start(http.wsUrl());
      set({ realtime: coord });
    }

    const hb = setInterval(() => {
      const r = get().localRuntime;
      const sim = get().missionSimulation;
      if (!r) {
        if (sim && get().mockSimulationEnabled) {
          const cur = get().flatEnvelope;
          const a = sim.tick(Date.now(), cur.phase, "mock");
          const flat = attachSimulation({ ...cur, capturedAtMs: Date.now() }, a, false);
          const bonus = Math.min(28, Math.floor(a.mapExploredBoost / 3));
          const mapModel = createFallbackMap(flat.missionId, flat.mapSummary.exploredCells + bonus);
          set({
            flatEnvelope: flat,
            simulationAug: a,
            mapModel: { ...mapModel, source: "mock" },
            tasks: mockOpenTasks(cur.scenario as MissionScenarioKind, cur.missionId, 3),
            rewards: mockRewardLines(cur.missionId, Object.keys(a.telemetryByNode)),
          });
        }
        return;
      }
      void (async () => {
        const env = r.buildEnvelope();
        let aug: SimulationAugmentation | null = null;
        if (sim && get().mockSimulationEnabled) {
          const src =
            get().connection.httpReachable && get().transport === "hybrid" ? ("live_http" as const) : ("local_engine" as const);
          aug = sim.tick(Date.now(), env.mission.phase, src);
          set({ simulationAug: aug });
        }
        await r.tickHeartbeats(
          aug
            ? (id) => {
                const p = aug!.telemetryByNode[id];
                if (!p) return null;
                const caps = env.mission.roster[id]?.capabilities ?? [];
                return {
                  batteryReserve: p.sensors.battery,
                  linkQuality: p.sensors.linkQuality,
                  sensors: caps.length ? caps : ["imu", "link"],
                };
              }
            : undefined,
        );
        get().refreshFromLocal();
      })();
    }, 4000);
    set({ heartbeatTimer: hb, loading: false });
  },

  setScenario: async (scenario) => {
    clearCheckpoint();
    set({ scenarioKey: scenario });
    await get().initWorkspace(scenario);
  },

  advancePhase: async () => {
    const rt = get().localRuntime;
    if (!rt) {
      set({ lastActionError: "No local mission engine (mock mode)" });
      return;
    }
    const r = await rt.advancePhase(get().operatorActorId);
    if (!r.ok) {
      set({ lastActionError: r.reason });
      get().pushEvent("vertex", `Phase advance rejected: ${r.reason}`, "local_engine");
      return;
    }
    get().refreshFromLocal();
    get().pushEvent("vertex", "Phase advanced", "local_engine");
    set({ lastActionError: null });
  },

  addTarget: async (targetId) => {
    const rt = get().localRuntime;
    if (!rt) {
      set({ lastActionError: "No local mission engine" });
      return;
    }
    await rt.addTarget(get().operatorActorId, targetId);
    get().refreshFromLocal();
    get().pushEvent("mission", `Target discovered ${targetId}`, "local_engine");
  },

  assignTask: async () => {
    const rt = get().localRuntime;
    if (!rt) return;
    await rt.assignDemoTask(get().operatorActorId);
    get().refreshFromLocal();
    get().pushEvent("task", "Task assigned (Vertex batch)", "local_engine");
  },

  saveCheckpoint: async (label) => {
    const rt = get().localRuntime;
    if (!rt) return;
    await rt.recordCheckpoint(get().operatorActorId, label);
    get().refreshFromLocal();
    get().pushEvent("recovery", `Checkpoint ${label}`, "local_engine");
  },

  sealSettlement: async () => {
    const rt = get().localRuntime;
    if (!rt) {
      set({ lastActionError: "Settlement requires local mission" });
      return;
    }
    const env = rt.buildEnvelope();
    if (env.mission.phase !== "complete" && env.mission.phase !== "aborted") {
      set({ lastActionError: "Mission not terminal" });
      return;
    }
    const res = await runSettlementSeal(rt.ledger, rt.registry, rt.missionId);
    if (!res.ok) {
      set({ lastActionError: res.error });
      return;
    }
    const base = rt.buildEnvelope();
    const merged = { ...base, ...res.envelopePatch };
    const flat = normalizeBackendEnvelopeToFlat(merged, "local_engine", rt.registry, Date.now());
    const tasks = tasksFromEnvelope(merged, "local_engine");
    const rewards = rewardsFromEnvelope(merged, "local_engine");
    const walletAddr = get().wallet.address ?? undefined;
    const settlement = settlementPreviewFromEnvelope(merged, walletAddr, "local_engine");
    const mapModel = createFallbackMap(flat.missionId, flat.mapSummary.exploredCells);
    set({
      fullEnvelope: merged,
      flatEnvelope: { ...flat, scenario: merged.mission.scenario ?? get().scenarioKey },
      tasks,
      rewards,
      settlementPreview: settlement,
      mapModel: { ...mapModel, source: "local_engine" },
    });
    get().pushEvent("arc", `Settlement sealed${res.mockTxHash ? ` · ${res.mockTxHash.slice(0, 12)}…` : ""}`, "local_engine");
    set({ lastActionError: null });
  },

  enableDemoWallet: () => {
    const seed = get().flatEnvelope.missionId;
    const w = buildDemoWalletView(seed);
    set({ demoWalletPreferred: true, wallet: w, operatorActorId: w.address ?? "operator-ui" });
    saveWalletSession({ mode: "demo", address: w.address, chainId: w.chainId, savedAtMs: Date.now() });
    get().pushEvent("wallet", "Demo wallet enabled", "mock");
  },

  applyLiveWallet: (address, chainId, status) => {
    if (!address) {
      clearWalletSession();
      set({ wallet: buildDisconnectedView(), operatorActorId: "operator-ui" });
      return;
    }
    set({
      wallet: {
        status,
        address,
        chainId,
        label: "Injected wallet",
        source: "live",
      },
      operatorActorId: address,
      demoWalletPreferred: false,
    });
    saveWalletSession({ mode: "injected", address, chainId, savedAtMs: Date.now() });
  },

  signMockReadiness: (label) => {
    const sig = mockSignPayload(label);
    get().pushEvent("wallet", `Mock sign ${sig}`, "mock", { label });
  },

  fastForwardDemo: async () => {
    const rt = get().localRuntime;
    if (!rt) return;
    const actor = get().operatorActorId;
    for (let i = 0; i < 14; i++) {
      const env = rt.buildEnvelope();
      if (env.mission.phase === "complete" || env.mission.phase === "aborted") break;
      const r = await rt.advancePhase(actor);
      if (!r.ok) break;
    }
    get().refreshFromLocal();
    get().pushEvent("mission", "Fast-forward demo steps", "local_engine");
  },

  setMockSimulationEnabled: (on) => {
    set({ mockSimulationEnabled: on });
    get().pushEvent("sim", on ? "Mock simulation enabled" : "Mock simulation paused (heartbeats only)", "mock");
  },

  toggleMeshPartition: () => {
    const sim = get().missionSimulation;
    if (!sim) return;
    const part = get().simulationAug?.mesh.partitionActive ?? false;
    sim.setPartition(!part);
    get().pushEvent("mesh", !part ? "Partition simulated" : "Mesh recovery simulated", "mock");
    const rt = get().localRuntime;
    if (rt) {
      const env = rt.buildEnvelope();
      const src =
        get().connection.httpReachable && get().transport === "hybrid" ? ("live_http" as const) : ("local_engine" as const);
      const a = sim.tick(Date.now(), env.mission.phase, src);
      set({ simulationAug: a });
      get().refreshFromLocal();
    } else {
      const cur = get().flatEnvelope;
      const a = sim.tick(Date.now(), cur.phase, "mock");
      const flat = attachSimulation({ ...cur, capturedAtMs: Date.now() }, a, false);
      const bonus = Math.min(28, Math.floor(a.mapExploredBoost / 3));
      const mapModel = createFallbackMap(flat.missionId, flat.mapSummary.exploredCells + bonus);
      set({
        simulationAug: a,
        flatEnvelope: flat,
        mapModel: { ...mapModel, source: "mock" },
      });
    }
  },

  forceMockNodeDrop: (nodeId) => {
    get().missionSimulation?.forceNodeDrop(nodeId);
    get().pushEvent("mesh", `Forced dropout ${nodeId}`, "mock");
  },

  injectMockTarget: () => {
    get().missionSimulation?.injectTargetSignal();
    get().pushEvent("mission", "Mock target signal injected", "mock");
  },

  injectMockSensorSpike: (nodeId) => {
    get().missionSimulation?.injectSensorSpike(nodeId);
    get().pushEvent("sensor", `Spike injected @ ${nodeId}`, "mock");
  },

  setMockSimulationPaused: (paused) => {
    get().missionSimulation?.setPaused(paused);
    get().pushEvent("sim", paused ? "Event stream paused" : "Event stream resumed", "mock");
  },

  setMockSimulationSpeed: (speed) => {
    get().missionSimulation?.setSimulationSpeed(speed);
    get().pushEvent("sim", `Simulation speed ×${speed}`, "mock");
  },

  replayMockEvents: (n) => {
    const sim = get().missionSimulation;
    if (!sim) return;
    const slice = sim.stream.tail(n);
    get().pushEvent("sim", `Replay tail ${slice.length} events`, "mock", { ids: slice.map((e) => e.id) });
  },
}));
