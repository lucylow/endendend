import type { MeshStepContext, MeshResiliencePublicView, NetworkStressMode } from "./types";
import { stressModeFromVertex } from "./types";
import { mulberry32 } from "./seededRng";
import { enrichPeerFromNode, createProfileRng } from "./peerProfiles";
import { buildMeshGraphView } from "./connectivityGraph";
import { advanceDiscovery } from "./peerDiscovery";
import { MeshConsensusEngine } from "./consensusEngine";
import type { VotePayload } from "./consensusEngine";
import { PartitionManager } from "./partitionManager";
import { MeshRecoveryManager } from "./recoveryManager";
import { MeshCheckpointStore } from "./checkpointStore";
import { MeshEventLedger, statusFor } from "./eventLedger";
import { RetryQueue } from "./retryQueue";
import { createMeshStressInjector } from "./blackoutInjector";
import { nextMockMeshTask } from "./mockMissionFactory";
import { allocateTask as pickWinner } from "./taskAllocator";
import { evaluateRoleHandoffs, applyHandoff } from "./roleManager";
import { buildReplayNarrative } from "./replayEngine";
import { clamp01 } from "./normalizers";

function syntheticClustersIfRequested(nodeIds: string[], operatorId: string, enabled: boolean): string[][] {
  if (!enabled || nodeIds.length < 4) return [nodeIds];
  const a: string[] = [];
  const b: string[] = [];
  nodeIds.forEach((id, i) => (i % 2 === 0 ? a : b).push(id));
  if (!a.includes(operatorId)) {
    const swapIdx = b.indexOf(operatorId);
    if (swapIdx >= 0 && a[0]) {
      const tmp = a[0];
      a[0] = operatorId;
      b[swapIdx] = tmp;
    }
  }
  return [a, b];
}

export class MeshResilienceSimulator {
  readonly ledger = new MeshEventLedger();
  readonly consensus = new MeshConsensusEngine();
  readonly partitionMgr = new PartitionManager();
  readonly recovery = new MeshRecoveryManager();
  readonly checkpoints = new MeshCheckpointStore();
  readonly injector = createMeshStressInjector("normal");
  private voteQueue = new RetryQueue<VotePayload>();
  private rng: () => number;
  private stats = {
    deliveredVotes: 0,
    droppedVotes: 0,
    delayedDeliveries: 0,
    duplicates: 0,
    bufferedWhileOffline: 0,
    reroutes: 0,
  };
  private taskHistory: MeshResiliencePublicView["taskHistory"] = [];
  private roleHistory: MeshResiliencePublicView["roleHistory"] = [];
  private discoveryPulse = 0;
  private lastStress: NetworkStressMode = "normal";
  private partitionWasActive = false;

  constructor(private readonly seed: number) {
    this.rng = mulberry32(seed >>> 0);
  }

  injectPacketLoss(delta01: number): void {
    this.injector.injectPacketLoss(delta01);
  }

  injectLatency(deltaMs: number): void {
    this.injector.injectLatency(deltaMs);
  }

  setManualPartition(active: boolean): void {
    this.injector.toggleManualPartition(active);
  }

  resetStress(): void {
    this.injector.reset();
  }

  private effectiveStressMode(ctx: MeshStepContext): NetworkStressMode {
    const base = stressModeFromVertex(ctx.connectivityMode);
    this.injector.controller.setMode(base);
    return this.injector.controller.mode;
  }

  async step(ctx: MeshStepContext): Promise<MeshResiliencePublicView> {
    const stress = this.effectiveStressMode(ctx);
    this.lastStress = stress;
    const vector = this.injector.controller.vector();
    const profileRng = createProfileRng((ctx.seed ^ ctx.tickIndex) >>> 0);
    const peers = new Map(
      ctx.nodes.map((n, i) => {
        const base = enrichPeerFromNode(n, i, profileRng);
        const q = ctx.telemetryQueueByNode?.[n.nodeId];
        if (typeof q === "number") base.queueDepth = q;
        return [n.nodeId, base] as const;
      }),
    );

    const clusters = syntheticClustersIfRequested(
      ctx.nodes.map((n) => n.nodeId),
      ctx.operatorNodeId,
      this.injector.manualPartition,
    );
    const syntheticPartition = this.injector.manualPartition && clusters.length > 1;

    this.partitionMgr.updateFromSnapshot(ctx.graph);
    this.partitionMgr.applyToPeers(peers, ctx.graph);
    advanceDiscovery(peers, ctx.graph, vector, this.rng);

    const meshGraph = buildMeshGraphView(ctx.graph, ctx.operatorNodeId, vector);

    const drained = this.voteQueue.drain(ctx.nowMs, {
      shouldDrop: (env) => {
        const p = peers.get(env.payload.peerId);
        const sens = p?.lossSensitivity01 ?? 0.3;
        const pLoss = clamp01(vector.loss01 * (0.65 + sens * 0.5) + vector.timeoutChance01 * 0.25);
        return this.rng() < pLoss;
      },
      backoffMs: (env) => 120 + env.attempts * 90 + Math.floor(vector.ackDelayMs * 0.35),
      maxAttempts: 5,
    });
    this.stats.droppedVotes += drained.dead;
    const reachablePopulation = ctx.nodes.filter((n) => !n.offline).map((n) => n.nodeId);
    for (const env of drained.ready) {
      this.stats.deliveredVotes++;
      if (this.rng() < vector.dup01) {
        this.stats.duplicates++;
        this.stats.delayedDeliveries++;
      }
      const res = this.consensus.registerVote(env.payload, reachablePopulation, vector, this.rng, ctx.nowMs);
      if (res.committed) {
        await this.ledger.append({
          missionId: ctx.missionId,
          actorPeerId: "vertex-mesh",
          eventType: "consensus_committed",
          payload: { proposalId: res.committed.id, votesYes: res.committed.votesYes.size },
          timestamp: ctx.nowMs,
          previousHash: this.ledger.tailHash(),
          sourceLabel: "vertex",
          commitmentStatus: statusFor("consensus_committed"),
        });
      }
      if (res.rejected) {
        await this.ledger.append({
          missionId: ctx.missionId,
          actorPeerId: "vertex-mesh",
          eventType: "consensus_rejected",
          payload: { proposalId: res.rejected.id },
          timestamp: ctx.nowMs,
          previousHash: this.ledger.tailHash(),
          sourceLabel: "vertex",
          commitmentStatus: statusFor("consensus_rejected"),
        });
      }
    }

    const proposal = this.consensus.maybeStartProposal(ctx.nowMs, this.rng, (id) => `Proof-of-Coordination batch ${id}`);
    if (proposal) {
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "lattice",
        eventType: "proposal_created",
        payload: { proposalId: proposal.id, summary: proposal.summary },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "lattice",
        commitmentStatus: statusFor("proposal_created"),
      });
      const voters = [...peers.values()].filter((p) => p.health !== "offline");
      for (const p of voters) {
        const delay =
          vector.baseLatencyMs +
          vector.jitterMs * this.rng() +
          p.latencyBiasMs +
          (ctx.graph.stalePeers.has(p.peerId) ? vector.ackDelayMs : 0);
        if (ctx.connectivityMode === "blackout" && this.rng() < 0.45) {
          this.stats.bufferedWhileOffline++;
          this.recovery.bufferForPeer(p.peerId, {
            atMs: ctx.nowMs,
            kind: "consensus_vote",
            payload: { proposalId: proposal.id, peerId: p.peerId },
          });
          continue;
        }
        const yes = this.rng() > p.byzantineLike01 + 0.08;
        this.voteQueue.enqueue({
          deliverAtMs: ctx.nowMs + delay,
          payload: { proposalId: proposal.id, peerId: p.peerId, yes },
        });
      }
    }

    if (ctx.tickIndex % 11 === 0 && this.rng() < 0.55) {
      const task = nextMockMeshTask(stress === "partitioned");
      const record = pickWinner(task, [...peers.values()], stress, ctx.nowMs);
      if (record) {
        this.taskHistory.push(record);
        await this.ledger.append({
          missionId: ctx.missionId,
          actorPeerId: record.winnerId,
          eventType: "task_mesh_assigned",
          payload: { taskId: record.taskId, score: record.score, reasons: record.reasons, fallbacks: record.fallbacks },
          timestamp: ctx.nowMs,
          previousHash: this.ledger.tailHash(),
          sourceLabel: "meshnet",
          commitmentStatus: statusFor("task_mesh_assigned"),
        });
      }
    }

    const handoffs = evaluateRoleHandoffs([...peers.values()], stress, this.rng, ctx.nowMs);
    for (const h of handoffs) {
      const peer = peers.get(h.peerId);
      if (peer) applyHandoff(peer, h.to);
      this.roleHistory.push(h);
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: h.peerId,
        eventType: "role_mesh_handoff",
        payload: { from: h.from, to: h.to, reason: h.reason },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "lattice",
        commitmentStatus: statusFor("role_mesh_handoff"),
      });
    }

    if (ctx.tickIndex % 9 === 0) {
      this.discoveryPulse++;
      const discoverer = [...peers.values()].find((p) => p.newlyDiscovered.length);
      if (discoverer) {
        const peerId = discoverer.newlyDiscovered[0];
        await this.ledger.append({
          missionId: ctx.missionId,
          actorPeerId: discoverer.peerId,
          eventType: "peer_discovered",
          payload: { peerId },
          timestamp: ctx.nowMs,
          previousHash: this.ledger.tailHash(),
          sourceLabel: "lattice",
          commitmentStatus: statusFor("peer_discovered"),
        });
      }
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "meshnet",
        eventType: "heartbeat_mesh",
        payload: { pulse: this.discoveryPulse, stress },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "meshnet",
        commitmentStatus: statusFor("heartbeat_mesh"),
      });
    }

    if (this.rng() < vector.loss01 * 0.35) {
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "meshnet",
        eventType: "packet_loss_sim",
        payload: { note: `loss=${vector.loss01.toFixed(2)}` },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "meshnet",
        commitmentStatus: statusFor("packet_loss_sim"),
      });
    }
    if (this.rng() < 0.05 + vector.routeInstability01 * 0.08) {
      this.stats.reroutes++;
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "meshnet",
        eventType: "topology_changed",
        payload: { reroute: true },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "meshnet",
        commitmentStatus: statusFor("topology_changed"),
      });
    }
    if (vector.baseLatencyMs > 140 && this.rng() < 0.12) {
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "meshnet",
        eventType: "delay_spike",
        payload: { deltaMs: Math.floor(vector.baseLatencyMs * 0.8) },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "meshnet",
        commitmentStatus: statusFor("delay_spike"),
      });
    }

    const partitionActive = ctx.graph.partitionClusters.length > 1 || syntheticPartition;
    if (partitionActive && !this.partitionWasActive) {
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "vertex-mesh",
        eventType: "partition_start",
        payload: { clusters: Math.max(ctx.graph.partitionClusters.length, clusters.length) },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "vertex",
        commitmentStatus: statusFor("partition_start"),
      });
    }
    if (!partitionActive && this.partitionWasActive) {
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "vertex-mesh",
        eventType: "partition_end",
        payload: {},
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "vertex",
        commitmentStatus: statusFor("partition_end"),
      });
      const pending = this.recovery.drainAll();
      if (pending.length) {
        await this.ledger.append({
          missionId: ctx.missionId,
          actorPeerId: "vertex-mesh",
          eventType: "recovery_sync",
          payload: { replayedVotes: pending.length },
          timestamp: ctx.nowMs,
          previousHash: this.ledger.tailHash(),
          sourceLabel: "vertex",
          commitmentStatus: statusFor("recovery_sync"),
        });
      }
    }
    this.partitionWasActive = partitionActive;

    if (ctx.tickIndex % 31 === 0) {
      const ck = `ckpt-${ctx.tickIndex}`;
      this.checkpoints.save(ck);
      await this.ledger.append({
        missionId: ctx.missionId,
        actorPeerId: "arc",
        eventType: "checkpoint_saved",
        payload: { ckptId: ck },
        timestamp: ctx.nowMs,
        previousHash: this.ledger.tailHash(),
        sourceLabel: "arc",
        commitmentStatus: statusFor("checkpoint_saved"),
      });
    }

    const events = this.ledger.toArray();
    const proposals = this.consensus.snapshot().map((p) => ({
      id: p.id,
      summary: p.summary,
      createdAtMs: p.createdAtMs,
      votesYes: p.votesYes.size,
      votesNo: p.votesNo.size,
      votesPending: Math.max(0, peers.size - p.votesYes.size - p.votesNo.size),
      quorumNeed: Math.max(2, Math.ceil(peers.size * 0.66)),
      status: p.decided,
      commitLatencyMs: p.commitLatencyMs,
    }));

    return {
      missionId: ctx.missionId,
      nowMs: ctx.nowMs,
      seed: ctx.seed,
      stressMode: stress,
      connectivityMode: ctx.connectivityMode,
      peers: [...peers.values()],
      graph: meshGraph,
      discoveryPulse: this.discoveryPulse,
      consensus: {
        health: {
          sequence: this.consensus.sequence,
          lastCommitHash: events.filter((e) => e.eventType === "consensus_committed").at(-1)?.eventHash,
          pending: proposals.filter((p) => p.status === "pending").length,
          committed: proposals.filter((p) => p.status === "committed").length,
          rejected: proposals.filter((p) => p.status === "rejected").length,
          stress01: clamp01(vector.loss01 + vector.timeoutChance01),
        },
        proposals,
      },
      ledgerTail: events.slice(-40),
      replay: buildReplayNarrative(events),
      taskHistory: this.taskHistory.slice(-20),
      roleHistory: this.roleHistory.slice(-20),
      checkpoints: this.checkpoints.list(),
      stats: { ...this.stats },
      liveMode: ctx.liveMode,
    };
  }
}
