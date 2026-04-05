import type { GossipMessage } from "@/types/p2p";
import { RELIABLE_BASE_DELAY_MS, RELIABLE_MAX_ATTEMPTS } from "@/config/swarmRobustness";

const STORAGE_KEY = "p2p_reliable_outbox_v1";

export type ReliablePayload = Record<string, unknown>;

export interface PendingReliable {
  id: string;
  dest: string;
  type: GossipMessage["type"];
  payload: ReliablePayload;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
}

function loadQueue(): PendingReliable[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingReliable[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(q: PendingReliable[]) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function loadReliableOutbox(): PendingReliable[] {
  return loadQueue();
}

export function enqueueReliable(
  dest: string,
  type: GossipMessage["type"],
  payload: ReliablePayload,
  now: number,
): PendingReliable {
  const pending: PendingReliable = {
    id: `rel-${now}-${Math.random().toString(36).slice(2, 9)}`,
    dest,
    type,
    payload,
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
  };
  const q = loadQueue();
  q.push(pending);
  saveQueue(q);
  return pending;
}

export function clearReliableOutbox() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Simulated reliable delivery: each pending item is "sent" with exponential backoff until
 * max attempts; success removes it from the outbox (persisted across reloads).
 */
export function processReliableOutbox(
  now: number,
  sourceNodeId: string,
  options?: { packetLossPercent?: number },
): {
  pending: PendingReliable[];
  sent: PendingReliable[];
  failed: PendingReliable[];
  messages: GossipMessage[];
} {
  const loss = options?.packetLossPercent ?? 0;
  const q = loadQueue();
  const sent: PendingReliable[] = [];
  const failed: PendingReliable[] = [];
  const messages: GossipMessage[] = [];
  const next: PendingReliable[] = [];

  for (const item of q) {
    if (now < item.nextAttemptAt) {
      next.push(item);
      continue;
    }
    const dropped = Math.random() * 100 < loss;
    if (!dropped) {
      sent.push(item);
      messages.push({
        id: item.id,
        type: item.type,
        source: sourceNodeId,
        target: item.dest,
        payload: { ...item.payload, _reliable: true },
        timestamp: now,
        ttl: 6,
      });
      continue;
    }
    const attempt = item.attempts + 1;
    if (attempt >= RELIABLE_MAX_ATTEMPTS) {
      failed.push({ ...item, attempts: attempt });
      continue;
    }
    const delay = RELIABLE_BASE_DELAY_MS * 2 ** (attempt - 1);
    next.push({
      ...item,
      attempts: attempt,
      nextAttemptAt: now + delay,
    });
  }

  saveQueue(next);
  return { pending: next, sent, failed, messages };
}
