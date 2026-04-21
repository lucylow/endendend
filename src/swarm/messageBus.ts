import { mulberry32 } from "./seededRng";

export type P2PMessageTopic = "state_sync" | "map_delta" | "task_bid" | "target_evidence" | "heartbeat";

export type P2PMessage = {
  id: string;
  from: string;
  to: string;
  topic: P2PMessageTopic;
  payload: unknown;
  createdAtMs: number;
  deliverAfterMs: number;
  attempts: number;
};

type Rng = () => number;

/**
 * Lightweight peer message fabric: per-node queues, delay, probabilistic loss/duplicates, retries.
 * Used by the mock runtime to model decentralized gossip rather than a central broker.
 */
export class P2PMessageBus {
  private queues = new Map<string, P2PMessage[]>();
  private rng: Rng;
  private serial = 1;

  constructor(seed = 1) {
    this.rng = mulberry32(seed ^ 0x9e3779b9);
  }

  private q(peer: string): P2PMessage[] {
    let a = this.queues.get(peer);
    if (!a) {
      a = [];
      this.queues.set(peer, a);
    }
    return a;
  }

  enqueue(msg: Omit<P2PMessage, "id" | "attempts"> & { attempts?: number }): P2PMessage {
    const full: P2PMessage = {
      ...msg,
      id: `p2p-${this.serial++}`,
      attempts: msg.attempts ?? 0,
    };
    this.q(msg.to).push(full);
    return full;
  }

  /** Simulate one delivery tick: returns messages actually delivered (after loss filter). */
  tick(nowMs: number, opts?: { lossBias01?: number; duplicateChance01?: number }): { delivered: P2PMessage[]; dropped: number } {
    const lossBias = opts?.lossBias01 ?? 0;
    const dupChance = opts?.duplicateChance01 ?? 0.04;
    const delivered: P2PMessage[] = [];
    let dropped = 0;
    for (const [, inbox] of this.queues) {
      const remain: P2PMessage[] = [];
      for (const m of inbox) {
        if (nowMs < m.createdAtMs + m.deliverAfterMs) {
          remain.push(m);
          continue;
        }
        const loss = Math.max(0, Math.min(0.65, 0.22 - m.attempts * 0.04 + lossBias + (this.rng() - 0.5) * 0.08));
        if (this.rng() < loss) {
          dropped++;
          if (m.attempts < 4) {
            remain.push({
              ...m,
              attempts: m.attempts + 1,
              deliverAfterMs: m.deliverAfterMs + 120 + Math.floor(this.rng() * 200),
              createdAtMs: nowMs,
            });
          }
          continue;
        }
        delivered.push(m);
        if (this.rng() < dupChance) {
          delivered.push({ ...m, id: `${m.id}-dup`, attempts: m.attempts });
        }
      }
      inbox.length = 0;
      inbox.push(...remain);
    }
    return { delivered, dropped };
  }

  depth(peer: string): number {
    return this.q(peer).length;
  }
}
