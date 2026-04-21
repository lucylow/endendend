import { mulberry32 } from "@/swarm/seededRng";
import type { MeshLedgerEvent } from "@/vertex2/types";
import { advanceDiscoveryRegistry, discoveryEntries, type DiscoveryCell } from "./discoveryEngine";
import { buildOperationalGraph } from "./connectivityGraph";
import { planRelays } from "./relayPlanner";
import { computeRoutePlans } from "./routeOptimizer";
import { constraintModeFromSignals, presetById } from "./networkConstraints";
import { summarizePartitions } from "./partitionManager";
import { MeshRecoveryBuffers } from "./recoveryManager";
import { MeshConsensusLedgerView } from "./consensusLedger";
import { buildMeshReplayNarrative } from "./replayEngine";
import { MeshMessageBus } from "./messageBus";
import { buildRichProfile, clusterIdForNode, updateProfileRuntime } from "./nodeProfiles";
import { applyTelemetryToProfiles, normalizeTelemetryBatch } from "./telemetryNormalizer";
import type { MeshConsolidatedEvent, MeshSurvivalPublicView, MeshSurvivalStepContext } from "./types";

function mapV2Ledger(ev: MeshLedgerEvent): MeshConsolidatedEvent {
  const sev: MeshConsolidatedEvent["severity"] =
    ev.eventType === "partition_start" || ev.eventType === "packet_loss_sim" ? "warn" : "info";
  return {
    id: ev.id,
    atMs: ev.timestamp,
    kind: ev.eventType,
    summary: `${ev.actorPeerId}: ${ev.eventType}`,
    severity: sev,
    meta: { ...ev.payload, sourceLabel: ev.sourceLabel },
  };
}

function reachableFn(snap: MeshSurvivalStepContext["graph"], op: string) {
  return (a: string, b: string) => {
    if (snap.stalePeers.has(a) || snap.stalePeers.has(b)) return false;
    const ra = snap.operatorReachable.has(a) || a === op;
    const rb = snap.operatorReachable.has(b) || b === op;
    if (!ra || !rb) return false;
    const adj = new Set<string>();
    for (const e of snap.edges) {
      if (e.a === a) adj.add(e.b);
      if (e.b === a) adj.add(e.a);
    }
    return adj.has(b);
  };
}

export class MeshSurvivalEngine {
  private rng: () => number;
  private seed: number;
  private discoveryCells = new Map<string, DiscoveryCell>();
  private bus = new MeshMessageBus();
  private recovery = new MeshRecoveryBuffers();
  private ledger = new MeshConsensusLedgerView();
  private prevClusterCount = 1;
  private recoveryPhase: MeshSurvivalPublicView["recovery"]["phase"] = "steady";
  private stressPresetId = "normal_mesh";
  private relayBoostUntilTick = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
  }

  /** Call on mission re-init so discovery / buffers do not leak across runs. */
  reset(seed?: number): void {
    if (typeof seed === "number") this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.discoveryCells.clear();
    this.bus = new MeshMessageBus();
    this.recovery = new MeshRecoveryBuffers();
    this.ledger = new MeshConsensusLedgerView();
    this.prevClusterCount = 1;
    this.recoveryPhase = "steady";
    this.relayBoostUntilTick = 0;
    this.stressPresetId = "normal_mesh";
  }

  setStressPreset(id: string): void {
    this.stressPresetId = presetById(id).id;
  }

  getStressPresetId(): string {
    return this.stressPresetId;
  }

  /** Demo hook: temporarily bias relay scoring and log nomination intent. */
  forceRelayNomination(nowMs: number, tickIndex: number): void {
    this.relayBoostUntilTick = tickIndex + 25;
    this.ledger.append(nowMs, "relay_nomination_forced", "Operator/UI requested relay emphasis for mesh continuity", "info", {
      untilTick: this.relayBoostUntilTick,
    });
  }


  step(ctx: MeshSurvivalStepContext): MeshSurvivalPublicView {
    const rng = mulberry32((ctx.seed ^ ctx.tickIndex * 2654435761) >>> 0);
    this.rng = rng;
    const v2 = ctx.meshV2;
    const loss01 = Math.min(0.92, v2.consensus.health.stress01 + presetById(this.stressPresetId).loss01 * 0.35);
    const preset = presetById(this.stressPresetId);

    const activeNodes = ctx.nodes.filter((n) => !n.offline);
    const profiles = activeNodes.map((n, i) =>
      buildRichProfile(n, i, ctx.nowMs, clusterIdForNode(n.nodeId, ctx.graph.partitionClusters)),
    );
    const telem =
      ctx.telemetry && ctx.telemetry.length ? applyTelemetryToProfiles(profiles, normalizeTelemetryBatch(ctx.telemetry, ctx.liveMode === "mock" ? "sim" : "live")) : profiles;

    advanceDiscoveryRegistry({
      snap: ctx.graph,
      observerIds: activeNodes.map((n) => n.nodeId),
      stress: v2.stressMode,
      loss01,
      rng,
      cells: this.discoveryCells,
    });

    const opGraph = buildOperationalGraph(ctx.graph, telem);
    let relayPlan = planRelays({
      operatorId: ctx.operatorNodeId,
      snap: ctx.graph,
      profiles: telem,
      graph: opGraph,
      rng,
    });
    if (ctx.tickIndex < this.relayBoostUntilTick && relayPlan[0]) {
      relayPlan = relayPlan.map((r, i) =>
        i === 0 ? { ...r, score01: Math.min(1, r.score01 + 0.18), reasons: [...r.reasons, "UI forced relay window"] } : r,
      );
    }

    const farthest = [...activeNodes]
      .filter((n) => n.nodeId !== ctx.operatorNodeId)
      .sort(
        (a, b) =>
          Math.hypot(a.position.x, a.position.z) - Math.hypot(b.position.x, b.position.z),
      )
      .slice(-5)
      .map((n) => n.nodeId);
    const routePlans = computeRoutePlans({ snap: ctx.graph, operatorId: ctx.operatorNodeId, targets: farthest });

    const reach = reachableFn(ctx.graph, ctx.operatorNodeId);
    if (ctx.tickIndex % 4 === 0) {
      for (let i = 0; i < Math.min(2, relayPlan.length); i++) {
        const r = relayPlan[i]!;
        this.bus.emitDirect({
          from: ctx.operatorNodeId,
          to: r.nodeId,
          missionId: ctx.missionId,
          nowMs: ctx.nowMs,
          seq: ctx.tickIndex + i,
          topic: "state_sync",
          body: { preset: preset.id, loss01 },
          loss01,
          reachable: reach,
          rng,
        });
      }
    }
    this.bus.tick({
      nowMs: ctx.nowMs,
      missionId: ctx.missionId,
      loss01,
      reachable: reach,
      rng,
    });

    const part = summarizePartitions(ctx.graph, ctx.operatorNodeId);
    if (part.clusterCount > this.prevClusterCount) {
      this.recoveryPhase = "buffering";
      for (const n of activeNodes) {
        this.recovery.buffer(n.nodeId, { atMs: ctx.nowMs, kind: "partition_buffer", payload: { clusters: part.clusterCount } });
      }
      this.ledger.append(ctx.nowMs, "partition_detected", `Clusters ↑ ${part.clusterCount} (operator side ${part.operatorClusterSize})`, "warn", {
        part,
      });
    }
    if (part.clusterCount < this.prevClusterCount && this.prevClusterCount > 1) {
      const flushed = this.recovery.drainAll(ctx.nowMs);
      this.recoveryPhase = flushed.length ? "flushing" : "merged";
      this.ledger.append(
        ctx.nowMs,
        "recovery_flush",
        `Merged partitions — flushed ${flushed.length} buffered items`,
        "info",
        { flushed: flushed.length },
      );
    } else if (this.recoveryPhase === "flushing") {
      this.recoveryPhase = "merged";
    } else if (part.clusterCount <= 1) {
      this.recoveryPhase = "steady";
    }
    this.prevClusterCount = part.clusterCount;

    if (ctx.tickIndex % 17 === 0) {
      this.ledger.append(
        ctx.nowMs,
        "mesh_autonomy_pulse",
        `Local autonomy sustained under ${v2.stressMode} (${preset.label})`,
        "info",
        { discoverySpeed: preset.discoverySpeed01 },
      );
    }

    const mergedTail = [...this.ledger.tail(22), ...v2.ledgerTail.slice(-14).map(mapV2Ledger)]
      .sort((a, b) => a.atMs - b.atMs)
      .slice(-44);

    const constraintMode = constraintModeFromSignals(ctx.connectivityMode, v2.stressMode);

    return {
      missionId: ctx.missionId,
      nowMs: ctx.nowMs,
      tickIndex: ctx.tickIndex,
      stressPresetId: this.stressPresetId,
      constraintMode,
      vertexConnectivity: ctx.connectivityMode,
      vertexStress: v2.stressMode,
      profiles: telem.map((p) =>
        updateProfileRuntime(p, {
          partitionClusterId: clusterIdForNode(p.nodeId, ctx.graph.partitionClusters),
        }),
      ),
      discovery: { entries: discoveryEntries(this.discoveryCells) },
      graph: opGraph,
      relayPlan,
      routePlans,
      bus: { recent: this.bus.snapshotRecent(), stats: this.bus.stats() },
      recovery: {
        phase: this.recoveryPhase,
        pendingFlush: this.recovery.pendingCount(),
        lastMergeAtMs: this.recovery.getLastFlushAt(),
      },
      ledgerTail: mergedTail,
      replay: buildMeshReplayNarrative(this.ledger.tail(50)),
      liveMode: ctx.liveMode,
    };
  }
}
