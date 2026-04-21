import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { FlatMissionEnvelope, SimulationAugmentation, DataSource } from "@/lib/state/types";
import type { LocalMissionRuntime } from "@/lib/runtime/localMissionRuntime";
import { buildMockNodeProfiles } from "./nodeFactory";
import { MeshSimulator } from "./meshSimulator";
import { SensorStreamGenerator } from "./sensorEngine";
import { MockEventStream } from "./eventStream";
import { nextMapDelta } from "./mapFactory";
import type { MockNodeProfile, MockNodeRole, TelemetryPacket } from "./types";
import { createFallbackFlatEnvelope, createFallbackMap, createFallbackRewards, createFallbackTasks } from "@/lib/api/fallback";
import { normalizeMapGridFromCells } from "@/lib/state/normalizers";

export type ScenarioRuntimeOptions = {
  seed: string;
  missionId: string;
  scenario: MissionScenarioKind;
  nodeProfiles?: MockNodeProfile[];
  forcedPartition?: boolean;
  telemetrySource?: TelemetryPacket["source"];
};

export class ScenarioSimulationRuntime {
  readonly stream = new MockEventStream();
  private mesh: MeshSimulator;
  private sensors = new Map<string, SensorStreamGenerator>();
  private profiles: MockNodeProfile[];
  private tickIdx = 0;
  private mapBoost = 0;
  private lastMesh = this.emptyMesh();
  private lastTelemetry: Record<string, TelemetryPacket> = {};
  private targetProximity01 = 0.12;

  constructor(private opts: ScenarioRuntimeOptions) {
    this.profiles =
      opts.nodeProfiles ??
      buildMockNodeProfiles(opts.scenario, opts.seed, 6, "sim").map((p, i) => ({
        ...p,
        nodeId: `sim-${opts.scenario.slice(0, 3)}-${i + 1}`,
      }));
    this.mesh = new MeshSimulator({
      seed: opts.seed,
      missionId: opts.missionId,
      nodeProfiles: this.profiles,
      forcedPartition: opts.forcedPartition,
    });
    for (const p of this.profiles) {
      this.sensors.set(p.nodeId, new SensorStreamGenerator(opts.seed, p, opts.scenario));
    }
  }

  /** Align mock mesh + sensor actors with the Vertex roster (same node ids). */
  static forLocalRuntime(rt: LocalMissionRuntime, seed: string): ScenarioSimulationRuntime {
    const env = rt.buildEnvelope();
    const scenario = rt.getScenario();
    const rosterIds = Object.keys(env.mission.roster);
    const templates = buildMockNodeProfiles(scenario, seed, Math.max(rosterIds.length, 4), "sync");
    const profiles: MockNodeProfile[] = rosterIds.map((id, i) => {
      const r = env.mission.roster[id]!;
      const t = templates[i] ?? templates[0]!;
      return {
        ...t,
        nodeId: id,
        role: r.role as MockNodeRole,
        capabilities: r.capabilities.length ? [...r.capabilities] : t.capabilities,
      };
    });
    return new ScenarioSimulationRuntime({ seed, missionId: rt.missionId, scenario, nodeProfiles: profiles });
  }

  private emptyMesh(): SimulationAugmentation["mesh"] {
    return {
      graphEdges: [],
      relayChain: { primary: [], backup: [], health: 0 },
      partitionActive: false,
      activePeers: [],
      stalePeers: [],
      delivery: { attempted: 0, delivered: 0, duplicates: 0, retries: 0, dropped: 0 },
      meanLatencyMs: 0,
      routeQuality: 0,
      messageHistoryTail: [],
      subscriptionsSample: [],
      source: "mock",
    };
  }

  setPartition(on: boolean): void {
    this.mesh.setPartition(on);
    const ev = on
      ? this.stream.emit("mesh_partition", { missionId: this.opts.missionId })
      : this.stream.emit("mesh_recovery", { missionId: this.opts.missionId });
    if (ev) {
      this.stream.emit("sensor_update", { note: on ? "degraded" : "recovered", at: ev.at });
    }
  }

  forceNodeDrop(nodeId: string): void {
    this.mesh.forceNodeOffline(nodeId, 12_000);
    this.stream.emit("node_heartbeat", { nodeId, stale: true });
  }

  injectTargetSignal(): void {
    this.targetProximity01 = Math.min(0.95, this.targetProximity01 + 0.22);
    this.stream.emit("target_detected", { missionId: this.opts.missionId, bump: this.targetProximity01 });
  }

  confirmTarget(): void {
    this.targetProximity01 = Math.min(1, this.targetProximity01 + 0.08);
    this.stream.emit("target_confirmed", { missionId: this.opts.missionId });
  }

  injectSensorSpike(nodeId: string): void {
    const g = this.sensors.get(nodeId);
    g?.injectImuBurst(5000);
    g?.injectFalsePositive(2800);
    this.stream.emit("sensor_update", { nodeId, spike: true });
  }

  resetTargetProximity(): void {
    this.targetProximity01 = 0.1;
  }

  setSimulationSpeed(speed: number): void {
    this.stream.setControls({ speed: Math.max(0.1, Math.min(8, speed)) });
  }

  setPaused(p: boolean): void {
    this.stream.setControls({ paused: p });
  }

  tick(nowMs: number, phase: string, envelopeSource: DataSource): SimulationAugmentation {
    this.tickIdx += 1;
    const ctrl = this.stream.getControls();
    if (ctrl.paused) {
      return {
        mesh: this.lastMesh,
        telemetryByNode: { ...this.lastTelemetry },
        mapExploredBoost: this.mapBoost,
        source: envelopeSource === "live" || envelopeSource === "live_http" ? envelopeSource : "mock",
      };
    }

    const mesh = this.mesh.tick(nowMs);
    this.lastMesh = { ...mesh, source: envelopeSource === "live_http" ? "live_http" : "mock" };

    const delta = nextMapDelta(this.opts.seed, this.opts.scenario, phase, this.tickIdx);
    this.mapBoost += delta.exploredDelta;
    this.stream.emit("map_delta", { delta, missionId: this.opts.missionId });

    this.targetProximity01 = Math.max(0.05, Math.min(0.98, this.targetProximity01 + (phase === "search" ? 0.006 : 0.002)));

    const telemetryByNode: Record<string, TelemetryPacket> = {};
    const src = this.opts.telemetrySource ?? "mock";
    for (const p of this.profiles) {
      const gen = this.sensors.get(p.nodeId);
      if (!gen) continue;
      const pkt = gen.emit(
        {
          missionId: this.opts.missionId,
          scenario: this.opts.scenario,
          phase,
          nowMs,
          mesh: this.lastMesh,
          targetProximity01: this.targetProximity01,
        },
        src,
      );
      telemetryByNode[p.nodeId] = pkt;
    }
    this.lastTelemetry = telemetryByNode;

    if (this.tickIdx % 11 === 0) {
      this.stream.emit("task_bid", { taskType: "frontier", scores: Object.keys(telemetryByNode).slice(0, 3) });
    }

    return {
      mesh: this.lastMesh,
      telemetryByNode,
      mapExploredBoost: this.mapBoost,
      source: envelopeSource === "live" || envelopeSource === "live_http" ? envelopeSource : "mock",
    };
  }

  getProfiles(): MockNodeProfile[] {
    return this.profiles;
  }

  static buildStandaloneEnvelope(scenario: MissionScenarioKind, missionId: string, seed: string): FlatMissionEnvelope {
    const base = createFallbackFlatEnvelope(scenario, missionId, seed);
    return {
      ...base,
      scenario,
      source: "fallback",
      capturedAtMs: Date.now(),
    };
  }

  static standaloneMap(missionId: string, explored: number, source: DataSource = "fallback") {
    const grid = normalizeMapGridFromCells(explored, `sim|${missionId}`, source);
    return { ...grid, source };
  }

  static standaloneTasksRewards(scenario: MissionScenarioKind, missionId: string, seed: string) {
    return {
      tasks: createFallbackTasks(scenario, seed),
      rewards: createFallbackRewards(seed),
      map: createFallbackMap(missionId, 40),
    };
  }
}
