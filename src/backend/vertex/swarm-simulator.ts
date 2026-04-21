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
import type {
  BlackoutSeverity,
  ConnectivitySnapshot,
  SimTelemetrySample,
  SwarmAgentNode,
  SwarmRuntimeConfig,
  SwarmTaskSpec,
} from "@/backend/vertex/swarm-types";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";
import type { LocalAutonomyDirective } from "@/backend/vertex/fallback-coordinator";
import { MonotonicSharedMap } from "@/swarm/sharedMap";
import { ExplorationCoordinator } from "@/swarm/explorationManager";
import { TargetDiscoveryPipeline } from "@/swarm/targetDiscovery";
import { RoleHandoffCoordinator } from "@/swarm/roleManager";
import type { TargetCandidate, NodeExplorationState, RoleHandoffRecord } from "@/swarm/types";
import type { MissionNodeRole } from "@/backend/shared/mission-state";
import { MeshResilienceSimulator } from "@/vertex2/meshResilienceSimulator";
import type { MeshResiliencePublicView } from "@/vertex2/types";
import { mulberry32 } from "@/swarm/seededRng";
import { effectiveOperatorPathQuality } from "@/swarm/networkModel";

let taskSerial = 1;
function nextTaskId(): string {
  return `vtx-task-${taskSerial++}`;
}

export type VertexSwarmView = {
  nowMs: number;
  missionId: string;
  /** Mesh “operator” / command anchor for reachability analytics (often a command-capable peer). */
  operatorNodeId: string;
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
  sharedMap: {
    cells: Record<string, import("@/swarm/types").MapCellMeta>;
    coverage01: number;
    explored: number;
    frontier: number;
    targetCells: number;
  };
  exploration: NodeExplorationState[];
  discovery: TargetCandidate[];
  roleHandoffs: RoleHandoffRecord[];
  /** Vertex 2.0 mesh resilience proof layer (synthetic stress, discovery, consensus, replay). */
  meshV2: MeshResiliencePublicView | null;
};

export class VertexSwarmSimulator {
  bus = new VertexEventBus();
  ledger: MissionLedger;
  graph = new ConnectivityGraph();
  blackout = new BlackoutSimulator();
  tasks = new TaskOrchestrator();
  telemetryNorm = new TelemetryNormalizer();
  sharedMap = new MonotonicSharedMap();
  explorationCoord = new ExplorationCoordinator();
  discoveryPipe = new TargetDiscoveryPipeline();
  roleCoord = new RoleHandoffCoordinator();
  readonly tickMs: number;
  readonly meshV2: MeshResilienceSimulator;

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
  private loggedDiscoveries = new Set<string>();

  constructor(missionId: string, config: SwarmRuntimeConfig, agentCount = 5) {
    this.missionId = missionId;
    this.config = config;
    this.rng = mulberry32(config.seed);
    this.nowMs = Date.now();
    this.tickMs = config.tickMs;
    this.ledger = new MissionLedger();
    this.meshV2 = new MeshResilienceSimulator(config.seed);
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
    this.loggedDiscoveries.clear();
    this.blackout.clearBlackout();
    this.tasks = new TaskOrchestrator();
    this.graph = new ConnectivityGraph();
    this.sharedMap = new MonotonicSharedMap();
    this.explorationCoord = new ExplorationCoordinator();
    this.discoveryPipe = new TargetDiscoveryPipeline();
    this.roleCoord = new RoleHandoffCoordinator();
    for (const n of this.nodes) {
      n.offline = false;
      n.healthStatus = "ok";
    }
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
      if (n.offline) continue;
      const wobble = () => (this.rng() - 0.5) * 0.8;
      n.position.x += wobble();
      n.position.z += wobble();
      n.position.y = n.mobility === "ground" ? 0 : Math.max(0, n.position.y + (this.rng() - 0.5) * 0.3);
    }
  }

  private emitTelemetry(connectivityMode: VertexConnectivityMode): void {
    this.telemetryBuf = [];
    for (const n of this.nodes) {
      if (n.offline) continue;
      const edge = this.graph.getEdge(n.nodeId, this.config.operatorNodeId);
      const q = edge?.quality01 ?? 0.35;
      const drain = n.capabilities.batteryDrainPerTick * (connectivityMode === "blackout" ? 0.85 : 1);
      n.trust01 = Math.max(0.35, Math.min(0.99, n.trust01 + (this.rng() - 0.48) * 0.002));
      const seq = (this.lastSeq.get(n.nodeId) ?? 0) + 1;
      this.lastSeq.set(n.nodeId, seq);
      n.lastHeartbeatMs = this.nowMs;
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

  private simulateBids(connectivityMode: VertexConnectivityMode, snap: ConnectivitySnapshot): void {
    const nodesById = new Map(this.nodes.map((n) => [n.nodeId, n]));
    for (const t of this.tasks.getTasks()) {
      if (t.status !== "open" && t.status !== "bidding") continue;
      for (const n of this.nodes) {
        if (this.rng() > 0.42 + n.capabilities.computeTier * 0.08) continue;
        const link = effectiveOperatorPathQuality(snap.edges, snap.operatorReachable, n.nodeId, this.config.operatorNodeId).quality01;
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
    const mapStats = this.sharedMap.coverageStats();
    const sug = suggestPhaseTransition(this.missionId, this.config.operatorNodeId, this.phase, next, this.nowMs, {
      cellsKnown: mapStats.explored + mapStats.frontier + Math.floor(done * 2),
    });
    if ("error" in sug) return;
    await commitVertexBatch(this.ledger, [sug]);
    this.phase = next;
  }

  private async maybeCheckpoint(): Promise<void> {
    if (this.tickCount % 22 !== 0) return;
    const st = this.sharedMap.coverageStats();
    const sug = suggestRecoveryCheckpoint(this.missionId, this.config.operatorNodeId, `ckpt-${this.tickCount}`, this.nowMs, {
      mapCells: Object.keys(this.sharedMap.snapshotCells()).length,
      coverage01: st.coverage01,
    });
    await commitVertexBatch(this.ledger, [sug]);
  }

  private spawnRescueTaskForTarget(candidate: TargetCandidate): void {
    const spec: SwarmTaskSpec = {
      taskId: nextTaskId(),
      missionId: this.missionId,
      taskType: "victim_extract",
      priority: 9,
      location: { ...candidate.world },
      requirements: ["thermal", "payload", "gripper"],
      allowedRoles: ["explorer", "relay", "carrier", "medic", "observer"],
      preferredVendorTraits: ["rescue", "heavy_lift"],
      minBattery01: 0.18,
      minTrust01: 0.35,
      minConnectivity01: 0.08,
      expiresAtMs: this.nowMs + 120_000,
      status: "open",
      bids: [],
      fallbackNodeIds: [],
      createdAtMs: this.nowMs,
    };
    this.tasks.openTask(spec);
    this.bus.emit({ type: "task_opened", taskId: spec.taskId });
  }

  private async commitTargetCandidateLedger(candidate: TargetCandidate, promoted: boolean): Promise<void> {
    if (!this.loggedDiscoveries.has(candidate.candidateId)) {
      this.loggedDiscoveries.add(candidate.candidateId);
      const ev = await this.ledger.append({
        missionId: this.missionId,
        actorId: candidate.evidence[0]?.nodeId ?? this.config.operatorNodeId,
        eventType: "target_discovered",
        plane: "vertex",
        payload: {
          targetId: candidate.candidateId,
          confidence: candidate.mergedConfidence01,
          gx: candidate.gx,
          gz: candidate.gz,
          notes: candidate.trustExplanation.join(";"),
        },
        timestamp: this.nowMs,
        previousHash: this.ledger.tailHash(),
      });
      this.bus.emit({ type: "ledger_committed", eventType: ev.eventType, eventHash: ev.eventHash });
    }
    if (promoted) {
      const ev = await this.ledger.append({
        missionId: this.missionId,
        actorId: candidate.confirmedByNodeId ?? this.config.operatorNodeId,
        eventType: "target_confirmed",
        plane: "vertex",
        payload: {
          targetId: candidate.candidateId,
          confidence: candidate.mergedConfidence01,
          corroboration: candidate.evidence.length,
        },
        timestamp: this.nowMs + 1,
        previousHash: this.ledger.tailHash(),
      });
      this.bus.emit({ type: "ledger_committed", eventType: ev.eventType, eventHash: ev.eventHash });
      this.bus.emit({ type: "target_confirmed_bus", candidateId: candidate.candidateId });
      this.sharedMap.applyLocalUpdate(candidate.gx, candidate.gz, "target", this.nowMs, candidate.confirmedByNodeId ?? "mesh", candidate.mergedConfidence01);
      this.spawnRescueTaskForTarget(candidate);
    }
  }

  private async commitRoleChange(nodeId: string, role: MissionNodeRole, reason: string): Promise<void> {
    const ev = await this.ledger.append({
      missionId: this.missionId,
      actorId: nodeId,
      eventType: "role_change",
      plane: "vertex",
      payload: { nodeId, role, reason },
      timestamp: this.nowMs,
      previousHash: this.ledger.tailHash(),
    });
    this.bus.emit({ type: "ledger_committed", eventType: ev.eventType, eventHash: ev.eventHash });
  }

  async tick(): Promise<VertexSwarmView> {
    if (!this.initialized) await this.initializeMission();
    this.tickCount += 1;
    this.nowMs += this.config.tickMs;
    this.bus.emit({ type: "tick", nowMs: this.nowMs });

    this.moveAgents();
    const simNodes = this.nodes.filter((n) => !n.offline);
    this.graph.rebuildFromNodes(simNodes.length ? simNodes : this.nodes, 22, this.rng);
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
    const active = this.nodes.filter((n) => !n.offline);
    const explorationStates = this.explorationCoord.step({
      map: this.sharedMap,
      nodes: active,
      connectivityMode,
      graph: snap,
      operatorId: this.config.operatorNodeId,
      nowMs: this.nowMs,
      rng: this.rng,
      scenarioMapHint: preset.mapBehavior,
    });
    this.explorationCoord.gossipMapDeltas(this.sharedMap, snap, this.nowMs, this.rng);

    for (const n of active) {
      const { gx, gz } = MonotonicSharedMap.worldToGrid(n.position.x, n.position.z);
      const cell = this.sharedMap.getCell(`${gx},${gz}`);
      if (cell?.state === "searched") {
        const hit = this.discoveryPipe.maybeSensorHit(n, this.config.scenario, this.rng);
        if (hit) {
          const { candidate, promoted } = this.discoveryPipe.addEvidence({
            missionId: this.missionId,
            node: n,
            sensor: hit.sensor,
            confidence01: hit.confidence01,
            nowMs: this.nowMs,
            scenario: this.config.scenario,
            note: hit.note,
          });
          this.bus.emit({
            type: "target_candidate",
            candidateId: candidate.candidateId,
            confidence01: candidate.mergedConfidence01,
          });
          await this.commitTargetCandidateLedger(candidate, promoted);
        }
      }
    }

    const handoffs = this.roleCoord.evaluate({
      nodes: active,
      connectivityMode,
      confirmedTargets: this.discoveryPipe.confirmedTargets(),
      operatorReachable: snap.operatorReachable,
      nowMs: this.nowMs,
      rng: this.rng,
    });
    for (const h of handoffs) {
      this.bus.emit({ type: "role_handoff", nodeId: h.nodeId, toRole: h.toRole, reason: h.reason });
      await this.commitRoleChange(h.nodeId, h.toRole, `${h.reason}: ${h.evidence}`);
    }

    const mapStats = this.sharedMap.coverageStats();
    this.bus.emit({ type: "map_updated", coverage01: mapStats.coverage01, frontier: mapStats.frontier });

    this.spawnTaskIfNeeded(preset);
    this.simulateBids(connectivityMode, snap);
    await this.assignOpenTasks(connectivityMode);
    await this.maybeAdvancePhase();
    await this.maybeCheckpoint();

    const events = this.ledger.toArray();
    const tail = events.slice(-40);
    const missionReplay = replayMissionFromLedger(events, this.missionId);

    const telemetryQueueByNode: Record<string, number> = {};
    for (const t of this.telemetryBuf) telemetryQueueByNode[t.nodeId] = t.queueDepth;
    const meshView = await this.meshV2.step({
      missionId: this.missionId,
      nowMs: this.nowMs,
      seed: this.config.seed,
      tickIndex: this.tickCount,
      connectivityMode,
      graph: snap,
      nodes: this.nodes,
      operatorNodeId: this.config.operatorNodeId,
      telemetryQueueByNode,
      liveMode: this.config.useMockFallback === false ? "live" : "mock",
    });

    return {
      nowMs: this.nowMs,
      missionId: this.missionId,
      operatorNodeId: this.config.operatorNodeId,
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
      sharedMap: (() => {
        const st = this.sharedMap.coverageStats();
        return {
          cells: this.sharedMap.snapshotCells(),
          coverage01: st.coverage01,
          explored: st.explored,
          frontier: st.frontier,
          targetCells: st.target,
        };
      })(),
      exploration: explorationStates,
      discovery: this.discoveryPipe.getCandidates().map((c) => ({
        ...c,
        evidence: c.evidence.map((e) => ({ ...e })),
        world: { ...c.world },
        trustExplanation: [...c.trustExplanation],
      })),
      roleHandoffs: this.roleCoord.getHistory(),
      meshV2: meshView,
    };
  }

  async forceBlackout(durationMs = 14_000, severity: BlackoutSeverity = "partial"): Promise<void> {
    if (!this.initialized) await this.initializeMission();
    this.blackout.startBlackout(this.nowMs, severity, durationMs);
    await this.commitBlackoutEnter(severity);
  }

  async recoverMesh(): Promise<void> {
    if (!this.initialized) await this.initializeMission();
    this.blackout.clearBlackout();
    await this.commitSyncReconciled();
  }

  forceNodeDropout(nodeId: string): void {
    const n = this.nodes.find((x) => x.nodeId === nodeId);
    if (!n) return;
    n.offline = true;
    n.healthStatus = "offline";
  }

  /** Force a role transition for UI demos (distributed handoff, not cloud-driven). */
  async forceRoleHandoff(nodeId: string): Promise<void> {
    if (!this.initialized) await this.initializeMission();
    const n = this.nodes.find((x) => x.nodeId === nodeId);
    if (!n || n.offline) return;
    const order: MissionNodeRole[] = ["relay", "explorer", "medic", "observer", "carrier"];
    const to = order[Math.floor(this.rng() * order.length)];
    if (n.role === to) return;
    const changed = this.roleCoord.applyHandoff(n, to, "manual_ui", "demo_intervention", this.nowMs);
    if (!changed) return;
    this.bus.emit({ type: "role_handoff", nodeId: n.nodeId, toRole: to, reason: "manual_ui" });
    await this.commitRoleChange(n.nodeId, n.role, "manual_ui");
  }

  meshInjectPacketLoss(delta01: number): void {
    this.meshV2.injectPacketLoss(delta01);
  }

  meshInjectLatency(deltaMs: number): void {
    this.meshV2.injectLatency(deltaMs);
  }

  meshTogglePartition(active: boolean): void {
    this.meshV2.setManualPartition(active);
  }

  meshResetStress(): void {
    this.meshV2.resetStress();
  }

  setUseMockFallback(v: boolean): void {
    this.config.useMockFallback = v;
  }

  async injectTargetNear(nodeId: string): Promise<void> {
    if (!this.initialized) await this.initializeMission();
    const n = this.nodes.find((x) => x.nodeId === nodeId);
    if (!n) return;
    const { gx, gz } = MonotonicSharedMap.worldToGrid(n.position.x, n.position.z);
    const cand = this.discoveryPipe.injectOperatorNote(this.missionId, gx, gz, { ...n.position }, this.nowMs);
    const peer = this.nodes.find((x) => x.nodeId !== nodeId && !x.offline);
    if (peer) {
      const r = this.discoveryPipe.addEvidence({
        missionId: this.missionId,
        node: peer,
        sensor: "peer_confirm",
        confidence01: 0.74,
        nowMs: this.nowMs,
        scenario: this.config.scenario,
        note: "injected_peer",
      });
      await this.commitTargetCandidateLedger(r.candidate, r.promoted);
      return;
    }
    await this.commitTargetCandidateLedger(cand, cand.status === "confirmed");
  }
}
