import type { MeshMessageEnvelope } from "./types";
import { createMeshEnvelope, markEnvelope } from "./messageEnvelope";
import { RetryQueue } from "./retryQueue";

type BusPayload = { topic: string; body: unknown };

/**
 * Peer-style bus with retry, buffering while unreachable, drop/duplicate simulation hooks.
 */
export class MeshMessageBus {
  private outbox = new RetryQueue<MeshMessageEnvelope>();
  private recent: MeshMessageEnvelope[] = [];
  private delivered = 0;
  private dropped = 0;
  private buffered = 0;
  private dupMerged = 0;
  private rerouted = 0;
  private seenIds = new Set<string>();

  stats() {
    return {
      delivered: this.delivered,
      dropped: this.dropped,
      buffered: this.buffered,
      duplicatesMerged: this.dupMerged,
      rerouted: this.rerouted,
    };
  }

  snapshotRecent(): MeshMessageEnvelope[] {
    return [...this.recent];
  }

  emitDirect(args: {
    from: string;
    to: string;
    missionId: string;
    nowMs: number;
    seq: number;
    topic: string;
    body: unknown;
    loss01: number;
    reachable: (a: string, b: string) => boolean;
    rng: () => number;
  }): void {
    const env = createMeshEnvelope({
      sender: args.from,
      receiver: args.to,
      topic: args.topic,
      timestamp: args.nowMs,
      missionId: args.missionId,
      sequence: args.seq,
      payload: { topic: args.topic, body: args.body } satisfies BusPayload,
    });
    const delay = 30 + Math.floor(args.rng() * 120 * (1 + args.loss01));
    if (!args.reachable(args.from, args.to)) {
      this.buffered++;
      this.outbox.enqueue({ deliverAtMs: args.nowMs + delay * 4, payload: env });
      return;
    }
    if (args.rng() < args.loss01) {
      this.dropped++;
      this.outbox.enqueue({ deliverAtMs: args.nowMs + delay * 2, payload: { ...env, retryCount: env.retryCount + 1 } });
      return;
    }
    this.delivered++;
    const delivered = markEnvelope(env, "delivered", [...env.pathTaken, args.to]);
    this.pushRecent(delivered);
  }

  tick(args: {
    nowMs: number;
    missionId: string;
    loss01: number;
    reachable: (a: string, b: string) => boolean;
    rng: () => number;
  }): void {
    const drained = this.outbox.drain(args.nowMs, {
      shouldDrop: () => args.rng() < args.loss01 * 0.55,
      backoffMs: (e) => 80 + e.attempts * 70,
      maxAttempts: 6,
    });
    this.dropped += drained.dead;
    for (const env of drained.ready) {
      const to = env.payload.receiver;
      if (typeof to !== "string" || to === "broadcast") continue;
      if (!args.reachable(env.payload.sender, to)) {
        this.buffered++;
        this.outbox.enqueue({ deliverAtMs: args.nowMs + 200, payload: env.payload });
        continue;
      }
      if (this.seenIds.has(env.payload.messageId)) {
        this.dupMerged++;
        continue;
      }
      this.seenIds.add(env.payload.messageId);
      this.delivered++;
      this.pushRecent(markEnvelope(env.payload, "delivered", [...env.payload.pathTaken, to]));
    }
  }

  private pushRecent(e: MeshMessageEnvelope): void {
    this.recent.unshift(e);
    this.recent = this.recent.slice(0, 24);
  }

  noteReroute(): void {
    this.rerouted++;
  }
}
