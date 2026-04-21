export type RetryEnvelope<T> = {
  deliverAtMs: number;
  attempts: number;
  payload: T;
};

export class RetryQueue<T> {
  private q: RetryEnvelope<T>[] = [];

  enqueue(item: Omit<RetryEnvelope<T>, "attempts"> & { attempts?: number }): void {
    this.q.push({ attempts: item.attempts ?? 0, deliverAtMs: item.deliverAtMs, payload: item.payload });
  }

  drain(
    nowMs: number,
    policy: {
      shouldDrop: (env: RetryEnvelope<T>) => boolean;
      backoffMs: (env: RetryEnvelope<T>) => number;
      maxAttempts: number;
    },
  ): { ready: RetryEnvelope<T>[]; dead: number; requeued: number } {
    const ready: RetryEnvelope<T>[] = [];
    let dead = 0;
    let requeued = 0;
    const next: RetryEnvelope<T>[] = [];
    for (const env of this.q) {
      if (env.deliverAtMs > nowMs) {
        next.push(env);
        continue;
      }
      if (policy.shouldDrop(env)) {
        if (env.attempts + 1 >= policy.maxAttempts) {
          dead++;
          continue;
        }
        requeued++;
        next.push({
          ...env,
          attempts: env.attempts + 1,
          deliverAtMs: nowMs + policy.backoffMs(env),
        });
        continue;
      }
      ready.push(env);
    }
    this.q = next;
    return { ready, dead, requeued };
  }

  size(): number {
    return this.q.length;
  }
}
