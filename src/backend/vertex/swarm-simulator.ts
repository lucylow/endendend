import type { MissionPhase } from "@/backend/shared/mission-phases";
import { nominalNextPhase } from "@/backend/shared/mission-phases";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import { commitVertexBatch, suggestPhaseTransition, suggestRecoveryCheckpoint } from "@/backend/vertex/consensus-gateway";
import { bootstrapMission } from "@/backend/api/missions";
import { createBaselineSwarmNodeList } from "@/backend/vertex/agent-profiles";
import { ConnectivityGraph } from "@/backend/vertex/connectivity-graph";
import { BlackoutSimulator } from "@/backend/vertex/blackout-simulator";
import { TaskOrchestrator } from "@/backend/vertex/task-orchestrator";
import { TelemetryNormalizer } from "@/backend/vertex/telemetry-normalizer";
import { localAutonomyDirectives } from "@/backend/vertex/fallback-coordinator";
import { VertexEventBus } from "@/backend/vertex/vertex-event-bus";
import { presetForScenario, type ScenarioPreset } from "@/backend/vertex/scenario-presets";
import type { SimTelemetrySample, SwarmAgentNode, SwarmRuntimeConfig, SwarmTaskSpec } from "@/backend/vertex/swarm-types";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";
import type { LocalAutonomyDirective } from "@/backend/vertex/fallback-coordinator";

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let taskSerial = 1;
function nextTaskId(): string {
  return `vtx-task-${taskSerial++}`;
}

export type VertexSwarmView = {
  nowMs: number;
  missionId: string;
  phase: MissionPhase;
  scenario: MissionScenarioKind;
  preset: ScenarioPreset;
  nodes: SwarmAgentNode[];
  telemetry: SimTelemetrySample[];
  connectivityMode: VertexConnectivityMode;
  graph: ConnectivitySnapshot;
  tasks: SwarmTaskSpec[];
  autonomy: LocalAutonomyDirective[];
  ledgerTail: MissionLedgerEvent[];
  missionReplay: ReturnType<typeof replayMissionFromLedger>;
  blackoutActive: boolean;
  seed: number;
  tickCount: number;
};

export class VertexSwarmSimulator {
  bus = new VertexEventBus();
  ledger: MissionLedger;
  graph = new ConnectivityGraph();
  blackout = new BlackoutSimulator();
  tasks = new TaskOrchestrator();
  telemetryNorm = new TelemetryNormalizer();
  readonly tickMs: number;

  private rng: () => number;
  private nodes: SwarmAgentNode[] = [];
  private nowMs: number;
  private phase: MissionPhase = "init";
  private missionId: string;
  private config: SwarmRuntimeConfig;
  private tickCount = 0;
  private telemetryBuf: SimTelemetrySample[] = [];
  private lastSeq = new Map<string, number>();
  private initialized = false;

  constructor(missionId: string, config: SwarmRuntimeConfig, agentCount = 5) {
    this.missionId = missionId;
    this.config = config;
    this.rng = mulberry32(config.seed);
    this.nowMs = Date.now();
    this.tickMs = config.tickMs;
    this.ledger = new MissionLedger();
    this.nodes = createBaselineSwarmNodeList(agentCount, 0.9);
    this.spreadInitialPositions();
  }

  private spreadInitialPositions(): void {
    let i = 0;
    for (const n of this.nodes) {
      const a = (i / Math.max(1, this.nodes.length)) * Math.PI * 2;
      n.position = { x: Math.cos(a) * 18 + this.rng() * 4, y: 0, z: Math.sin(a) * 18 + this.rng() * 4 };
      i++;
    }
  }

  getPreset(): ScenarioPreset {
    return presetForScenario(this.config.scenario);
  }

  async initializeMission(): Promise<void> {
    taskSerial = 1;
    this.telemetryNorm.reset();
    this.lastSeq.clear();
    this.tickCount = 0;
    this.blackout.clearBlackout();
    this.tasks = new TaskOrchestrator();
    this.graph = new ConnectivityGraph();
    const boot = await bootstrapMission(this.missionId, this.config.operatorNodeId, this.nowMs, {
      scenario: this.config.scenario,
    });
    this.ledger = boot.ledger;
    for (const n of this.nodes) {
      await this.ledger.append({
        missionId: this.missionId,
        actorId: n.nodeId,
        eventType: "node_join",
        plane: "vertex",
        payload: { nodeId: n.nodeId, role: n.role, capabilities: n.capabilities.sensors },
        timestamp: this.nowMs + 1,
        previousHash: this.ledger.tailHash(),
      });
    }
    const sug = suggestPhaseTransition(this.missionId, this.config.operatorNodeId, "init", "discovery", this.nowMs + 2);
    if (!("error" in sug)) await commitVertexBatch(this.ledger, [sug]);
    this.phase = "discovery";
    this.initialized = true;
  }

  private moveAgents(): void {
    for (const n of this.nodes) {
      const wobble = () => (this.rng() - 0.5) * 0.8;
      n.position.x += wobble();
      n.position.z += wobble();
      n.position.y = n.mobility === "ground" ? 0 : Math.max(0, n.position.y + (this.rng() - 0.5) * 0.3);
    }
  }

  private emitTelemetry(connectivityMode: VertexConnectivityMode): void {
    this.telemetryBuf = [];
    for (const n of this.nodes) {
      const edge = this.graph.getEdge(n.nodeId, this.config.operatorNodeId);
      const q = edge?.quality01 ?? 0.35;
      const drain = n.capabilities.batteryDrainPerTick * (connectivityMode === "blackout" ? 0.85 : 1);
      n.trust01 = Math.max(0.35, Math.min(0.99, n.trust01 + (this.rng() - 0.48) * 0.002));
      const seq = (this.lastSeq.get(n.nodeId) ?? 0) + 1;
      this.lastSeq.set(n.nodeId, seq);
      const raw: SimTelemetrySample = {
        nodeId: n.nodeId,
        battery01: Math.max(0.08, 0.97 - drain * this.tickCount * 0.02),
        cpu01: 0.2 + this.rng() * 0.35,
        mem01: 0.35 + this.rng() * 0.25,
        link01: Math.max(0.05, q * (connectivityMode === "normal" ? 1 : 0.55)),
        queueDepth: connectivityMode === "normal" ? Math.floor(this.rng() * 4) : Math.floor(4 + this.rng() * 10),
        sensorConfidence01: Math.min(1, 0.55 + n.capabilities.gpsImuConfidence * 0.25 + this.rng() * 0.15),
        sequence: seq,
        emittedAtMs: this.nowMs,
        receivedAtMs: this.nowMs + Math.floor(this.blackout.messageDelayMs(edge, this.rng)),
      };
      const norm = this.telemetryNorm.normalize(raw);
      this.telemetryBuf.push(norm);
      this.bus.emit({ type: "telemetry", sample: norm });
    }
  }

  private scheduleBlackoutIfNeeded(): void {
    const preset = this.getPreset();
    if (this.blackout.getState().active) return;
    if (this.tickCount > 8 && this.tickCount % 47 === 0 && this.rng() < preset.risk01 * 0.35) {
      const sev = this.rng() < 0.25 ? "full" : this.rng() < 0.55 ? "partial" : "degraded";
      this.blackout.startBlackout(this.nowMs, sev, 12_000 + Math.floor(this.rng() * 8000));
      void this.commitBlackoutEnter(sev);
    }
  }

  /** Advance blackout stress on links; commit sync when the mesh recovers. */
  private stepConnectivity(): VertexConnectivityMode {
    const wasActive = this.blackout.getState().active;
    const tickResult = this.blackout.tick(this.graph, this.nowMs, this.rng);
    const active = this.blackout.getState().active;
    if (wasActive && !active) void this.commitSyncReconciled();
    if (active) return this.blackout.vertexModeFromBlackout();
    return tickResult === "recovery" ? "recovery" : "normal";
  }

  private async commitBlackoutEnter(severity: string): Promise<void> {
    const mode: VertexConnectivityMode =
      severity === "full" ? "blackout" : severity === "partial" ? "partial_partition" : "degraded";
    const ev = await this.ledger.append({
      missionId: this.missionId,
      actorId: this.config.operatorNodeId,
      eventType: "blackout_entered",
      plane: "vertex",
      payload: { mode, severity },
      timestamp: this.nowMs,
      previousHash: this.ledger.tailHash(),
    });
    this.bus.emit({ type: "ledger_committed", eventType: ev.eventType, eventHash: ev.eventHash });
    this.bus.emit({ type: "blackout", active: true, severity });
  }

  private async commitSyncReconciled(): Promise<void> {
    const ev = await this.ledger.append({
      missionId: this.missionId,
      actorId: this.config.operatorNodeId,
      eventType: "sync_reconciled",
      plane: "vertex",
      payload: { tick: this.tickCount },
      timestamp: this.nowMs,
      previousHash: this.ledger.tailHash(),
    });
    this.bus.emit({ type: "ledger_committed", eventType: ev.eventType, eventHash: ev.eventHash });
    this.bus.emit({ type: "blackout", active: false });
  }

  private spawnTaskIfNeeded(preset: ScenarioPreset): void {
    const open = this.tasks.getTasks().filter((t) => t.status === "open" || t.status === "bidding").length;
    if (open >= 2) return;
    if (this.tickCount % 6 !== 0) return;
    const bias = preset.taskBias[this.tickCount % preset.taskBias.length] ?? "scout";
    const loc = { x: this.rng() * 40 - 20, y: 0, z: this.rng() * 40 - 20 };
    const spec: SwarmTaskSpec = {
      taskId: nextTaskId(),
      missionId: this.missionId,
      taskType: bias.includes("relay") ? "relay_extension" : bias.includes("extract") ? "extraction_prep" : "sector_search",
      priority: 5 + Math.floor(this.rng() * 4),
      location: loc,
      requirements: preset.sensorEmphasis.slice(0, 2),
      allowedRoles: ["explorer", "relay", "carrier", "medic", "observer"],
      preferredVendorTraits: preset.commExpectation === "sparse" ? ["mesh", "relay_grade"] : ["long_range"],
      minBattery01: 0.22,
      minTrust01: 0.4,
      minConnectivity01: 0.12,
      expiresAtMs: this.nowMs + 60_000,
      status: "open",
      bids: [],
      fallbackNodeIds: [],
      createdAtMs: this.nowMs,
    };
    this.tasks.openTask(spec);
    this.bus.emit({ type: "task_opened", taskId: spec.taskId });
  }

  private simulateBids(connectivityMode: VertexConnectivityMode): void {
    const nodesById = new Map(this.nodes.map((n) => [n.nodeId, n]));
    for (const t of this.tasks.getTasks()) {
      if (t.status !== "open" && t.status !== "bidding") continue;
      for (const n of this.nodes) {
        if (this.rng() > 0.42 + n.capabilities.computeTier * 0.08) continue;
        const edge = this.graph.getEdge(n.nodeId, this.config.operatorNodeId);
        const link = edge?.quality01 ?? 0.2;
        this.tasks.submitBid(t.taskId, {
          nodeId: n.nodeId,
          etaSec: 30 + Math.floor(this.rng() * 180),
          confidence01: 0.45 + this.rng() * 0.45,
          battery01: 0.35 + this.rng() * 0.55,
          link01: link,
          submittedAtMs: this.nowMs,
          status: "submitted",
          scoreReasons: [],
        });
      }
      this.tasks.markStaleBids(t.taskId, 25_000, this.nowMs);
      this.tasks.scorePendingBids(t.taskId, nodesById, {
        phase: this.phase,
        connectivityMode,
        swarmLoad: this.tasks.getTasks().filter((x) => x.status === "assigned").length / Math.max(1, this.nodes.length),
      });
    }
  }

  private async assignOpenTasks(connectivityMode: VertexConnectivityMode): Promise<void> {
    const nodesById = new Map(this.nodes.map((n) => [n.nodeId, n]));
    for (const t of this.tasks.getTasks()) {
      if (t.status !== "bidding" && t.status !== "open") continue;
      if (!t.bids.some((b) => b.status === "submitted")) continue;
      if (connectivityMode === "blackout" && this.rng() < 0.55) {
        await this.ledger.append({
          missionId: this.missionId,
          actorId: this.config.operatorNodeId,
          eventType: "local_autonomy_activated",
          plane: "vertex",
          payload: { taskId: t.taskId, note: "deferred_assignment_until_sync" },
          timestamp: this.nowMs,
          previousHash: this.ledger.tailHash(),
        });
        continue;
      }
      const { winner, fallbacks, reason } = this.tasks.assignWinner(t.taskId, this.nowMs);
      if (!winner || reason === "no_eligible_bids") continue;
      const winningBid = t.bids.find((b) => b.nodeId === winner);
      const sugReasons = winningBid?.scoreReasons ?? [];
      const ev = await this.ledger.append({
        missionId: this.missionId,
        actorId: this.config.operatorNodeId,
        eventType: "task_assigned",
        plane: "vertex",
        payload: { taskId: t.taskId, nodeId: winner, taskType: t.taskType, fallbacks },
        timestamp: this.nowMs,
        previousHash: this.ledger.tailHash(),
      });
      this.bus.emit({ type: "ledger_committed", eventType: ev.eventType, eventHash: ev.eventHash });
      this.bus.emit({ type: "task_assigned", taskId: t.taskId, nodeId: winner, reasons: sugReasons });
      if (this.rng() < 0.35) {
        await this.ledger.append({
          missionId: this.missionId,
          actorId: winner,
          eventType: "task_completed",
          plane: "vertex",
          payload: { taskId: t.taskId },
          timestamp: this.nowMs + 1,
          previousHash: this.ledger.tailHash(),
        });
        this.tasks.completeTask(t.taskId);
      }
    }
    const viable = (nodeId: string) => {
      const tel = this.telemetryBuf.find((x) => x.nodeId === nodeId);
      return tel != null && tel.link01 > 0.08 && !tel.duplicate;
    };
    for (const t of this.tasks.getTasks()) {
      if (t.status !== "assigned" || !t.winnerNodeId) continue;
      const next = this.tasks.reassignFromFallback(t.taskId, nodesById, viable, this.nowMs);
      if (next) {
        await this.ledger.append({
          missionId: this.missionId,
          actorId: this.config.operatorNodeId,
          eventType: "task_reassigned",
          plane: "vertex",
          payload: { taskId: t.taskId, newNodeId: next, taskType: t.taskType },
          timestamp: this.nowMs,
          previousHash: this.ledger.tailHash(),
        });
      }
    }
  }

  private async maybeAdvancePhase(): Promise<void> {
    const mission = replayMissionFromLedger(this.ledger.toArray(), this.missionId);
    this.phase = mission.phase;
    const done = this.tasks.getTasks().filter((t) => t.status === "completed").length;
    if (done < 1 + Math.floor(this.tickCount / 40)) return;
    const next = nominalNextPhase(this.phase);
    if (!next || next === "aborted") return;
    const sug = suggestPhaseTransition(this.missionId, this.config.operatorNodeId, this.phase, next, this.nowMs, {
      cellsKnown: 12 + done * 3,
    });
    if ("error" in sug) return;
    await commitVertexBatch(this.ledger, [sug]);
    this.phase = next;
  }

  private async maybeCheckpoint(): Promise<void> {
    if (this.tickCount % 22 !== 0) return;
    const sug = suggestRecoveryCheckpoint(this.missionId, this.config.operatorNodeId, `ckpt-${this.tickCount}`, this.nowMs);
    await commitVertexBatch(this.ledger, [sug]);
  }

  async tick(): Promise<VertexSwarmView> {
    if (!this.initialized) await this.initializeMission();
    this.tickCount += 1;
    this.nowMs += this.config.tickMs;
    this.bus.emit({ type: "tick", nowMs: this.nowMs });

    this.moveAgents();
    this.graph.rebuildFromNodes(this.nodes, 22, this.rng);
    this.scheduleBlackoutIfNeeded();
    const connectivityMode = this.stepConnectivity();

    this.emitTelemetry(connectivityMode);
    const stale = new Set<string>();
    for (const s of this.telemetryBuf) {
      if (s.duplicate || s.link01 < 0.11 || this.nowMs - s.receivedAtMs > this.config.staleHeartbeatMs) {
        stale.add(s.nodeId);
      }
    }
    const snap = this.graph.snapshot(this.config.operatorNodeId, this.nodes, stale);
    this.bus.emit({ type: "connectivity", mode: connectivityMode });

    const opReach = snap.operatorReachable.has.bind(snap.operatorReachable);
    const autonomy = this.nodes.map((n) =>
      localAutonomyDirectives(n, connectivityMode, opReach(n.nodeId)),
    );

    const preset = this.getPreset();
    this.spawnTaskIfNeeded(preset);
    this.simulateBids(connectivityMode);
    await this.assignOpenTasks(connectivityMode);
    await this.maybeAdvancePhase();
    await this.maybeCheckpoint();

    const events = this.ledger.toArray();
    const tail = events.slice(-40);
    const missionReplay = replayMissionFromLedger(events, this.missionId);

    return {
      nowMs: this.nowMs,
      missionId: this.missionId,
      phase: missionReplay.phase,
      scenario: this.config.scenario,
      preset,
      nodes: this.nodes.map((n) => ({ ...n, capabilities: { ...n.capabilities }, position: { ...n.position } })),
      telemetry: [...this.telemetryBuf],
      connectivityMode,
      graph: snap,
      tasks: this.tasks.getTasks().map((t) => ({
        ...t,
        bids: t.bids.map((b) => ({ ...b, scoreReasons: [...b.scoreReasons] })),
        fallbackNodeIds: [...t.fallbackNodeIds],
      })),
      autonomy,
      ledgerTail: tail,
      missionReplay,
      blackoutActive: this.blackout.getState().active,
      seed: this.config.seed,
      tickCount: this.tickCount,
    };
  }
}
