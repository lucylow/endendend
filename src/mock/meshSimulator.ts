import { SeededRandom } from "./seededRandom";
import type {
  MeshDeliveryStats,
  MeshLinkView,
  MeshRelayChain,
  MeshSummaryViewModel,
  MockNodeProfile,
} from "./types";
import { defaultTopicBundle } from "./scenarios";

type SimMeshNode = {
  id: string;
  load: number;
  trust01: number;
  relayQuality: number;
  offline: boolean;
  staleUntil: number;
};

export type MeshSimulatorConfig = {
  seed: string;
  missionId: string;
  nodeProfiles: MockNodeProfile[];
  forcedPartition?: boolean;
};

export class MeshSimulator {
  private rng: SeededRandom;
  private nodes: SimMeshNode[] = [];
  private delivery: MeshDeliveryStats = { attempted: 0, delivered: 0, duplicates: 0, retries: 0, dropped: 0 };
  private msgSeq = 0;
  private history: MeshSummaryViewModel["messageHistoryTail"] = [];
  private partition = false;
  private nowMs = Date.now();

  constructor(private cfg: MeshSimulatorConfig) {
    this.rng = new SeededRandom(`${cfg.seed}|mesh`);
    this.nodes = cfg.nodeProfiles.map((p) => ({
      id: p.nodeId,
      load: this.rng.nextFloat(0.08, 0.35),
      trust01: p.trust01,
      relayQuality: p.relayQuality,
      offline: false,
      staleUntil: 0,
    }));
  }

  setPartition(on: boolean): void {
    this.partition = on || !!this.cfg.forcedPartition;
  }

  getPartition(): boolean {
    return this.partition || !!this.cfg.forcedPartition;
  }

  forceNodeOffline(nodeId: string, ms: number): void {
    const n = this.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    n.offline = true;
    n.staleUntil = this.nowMs + ms;
  }

  tick(nowMs: number): MeshSummaryViewModel {
    this.nowMs = nowMs;
    for (const n of this.nodes) {
      if (n.offline && nowMs > n.staleUntil) {
        n.offline = false;
      }
      n.load = Math.max(0.05, Math.min(0.95, n.load + this.rng.nextFloat(-0.04, 0.06)));
    }

    const relays = this.cfg.nodeProfiles.filter((p) => p.role === "relay").map((p) => p.nodeId);
    const explorers = this.cfg.nodeProfiles.filter((p) => p.role === "explorer").map((p) => p.nodeId);
    const primary =
      relays.length >= 2
        ? [explorers[0] ?? relays[0]!, relays[0]!, relays[1] ?? relays[0]!].filter(Boolean)
        : relays.length === 1
          ? [explorers[0] ?? this.nodes[0]!.id, relays[0]!]
          : [this.nodes[0]!.id, this.nodes[1]?.id ?? this.nodes[0]!.id];

    const graphEdges = this.buildEdges(relays);
    const part = this.getPartition();
    const activePeers = this.nodes.filter((n) => !n.offline && !part).map((n) => n.id);
    const stalePeers = this.nodes.filter((n) => n.offline || nowMs < n.staleUntil || (part && !relays.includes(n.id))).map((n) => n.id);

    this.simulateMessageBurst(part);

    const latencies = graphEdges.map((e) => e.latencyMs);
    const meanLatencyMs = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const routeQuality = Math.max(0, Math.min(1, 1 - meanLatencyMs / 400 - (part ? 0.45 : 0)));

    const topics = defaultTopicBundle(this.cfg.missionId);
    const subscriptionsSample = this.cfg.nodeProfiles.slice(0, 5).map((p) => ({
      nodeId: p.nodeId,
      topics: this.rng.next() > 0.4 ? topics.slice(0, 3) : topics.slice(1, 4),
    }));

    const relayChain: MeshRelayChain = {
      primary,
      backup: relays.filter((r) => !primary.includes(r)).slice(0, 2),
      health: routeQuality,
    };

    return {
      graphEdges,
      relayChain,
      partitionActive: part,
      activePeers,
      stalePeers: [...new Set(stalePeers)],
      delivery: { ...this.delivery },
      meanLatencyMs: Math.round(meanLatencyMs),
      routeQuality: Math.round(routeQuality * 1000) / 1000,
      messageHistoryTail: [...this.history].slice(-12),
      subscriptionsSample,
      source: "mock",
    };
  }

  private buildEdges(relays: string[]): MeshLinkView[] {
    const edges: MeshLinkView[] = [];
    const online = this.nodes.filter((n) => !n.offline);
    for (let i = 0; i < online.length; i++) {
      for (let j = i + 1; j < online.length; j++) {
        if (this.rng.next() > 0.42) continue;
        const a = online[i]!;
        const b = online[j]!;
        const relay = relays.includes(a.id) || relays.includes(b.id);
        const distStress = Math.abs(a.load - b.load);
        const latencyMs = Math.round(
          20 + this.rng.nextFloat(0, 120) * (1 + distStress * 3) * (relay ? 0.85 : 1.15) * (this.partition ? 2.2 : 1),
        );
        const lossPct = Math.round(this.rng.nextFloat(0, 8) * (this.partition ? 2.5 : 1) * 10) / 10;
        const quality = Math.max(0, Math.min(1, 1 - lossPct / 35 - latencyMs / 500));
        const status =
          lossPct > 12 || latencyMs > 220 ? "down" : lossPct > 6 || latencyMs > 140 ? "degraded" : this.rng.next() > 0.92 ? "stale" : "up";
        edges.push({ from: a.id, to: b.id, latencyMs, lossPct, quality, status, relay });
      }
    }
    return edges;
  }

  private simulateMessageBurst(partition: boolean): void {
    for (let k = 0; k < 3; k++) {
      this.msgSeq += 1;
      const id = `m-${this.msgSeq}`;
      const topic = defaultTopicBundle(this.cfg.missionId)[this.rng.nextInt(0, 5)]!;
      this.delivery.attempted += 1;
      const dropP = partition ? 0.35 : 0.06;
      const dupP = 0.04;
      const retryP = 0.08;
      if (this.rng.next() < dropP) {
        this.delivery.dropped += 1;
        this.history.push({ id, topic, delivered: false, latencyMs: 0, at: this.nowMs });
        continue;
      }
      if (this.rng.next() < retryP) this.delivery.retries += 1;
      if (this.rng.next() < dupP) this.delivery.duplicates += 1;
      this.delivery.delivered += 1;
      const latencyMs = Math.round(this.rng.nextFloat(25, partition ? 420 : 180));
      this.history.push({ id, topic, delivered: true, latencyMs, at: this.nowMs });
    }
  }
}
