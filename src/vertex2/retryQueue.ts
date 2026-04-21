export type RetryEnvelope<T> = {
  id: string;
  deliverAtMs: number;
  attempts: number;
  payload: T;
};

export class RetryQueue<T> {
  private items: RetryEnvelope<T>[] = [];
  private serial = 1;

  enqueue(item: Omit<RetryEnvelope<T>, "id" | "attempts"> & { attempts?: number }): RetryEnvelope<T> {
    const env: RetryEnvelope<T> = {
      id: `rq-${this.serial++}`,
      attempts: item.attempts ?? 0,
      deliverAtMs: item.deliverAtMs,
      payload: item.payload,
    };
    this.items.push(env);
    return env;
  }

  /** Returns ready items, reschedules dropped according to shouldDrop callback. */
  drain(
    nowMs: number,
    opts: {
      shouldDrop: (env: RetryEnvelope<T>) => boolean;
      backoffMs: (env: RetryEnvelope<T>) => number;
      maxAttempts: number;
    },
  ): { ready: RetryEnvelope<T>[]; rescheduled: number; dead: number } {
    const ready: RetryEnvelope<T>[] = [];
    const remain: RetryEnvelope<T>[] = [];
    let rescheduled = 0;
    let dead = 0;
    for (const env of this.items) {
      if (nowMs < env.deliverAtMs) {
        remain.push(env);
        continue;
      }
      if (opts.shouldDrop(env)) {
        if (env.attempts + 1 >= opts.maxAttempts) {
          dead++;
          continue;
        }
        rescheduled++;
        remain.push({
          ...env,
          attempts: env.attempts + 1,
          deliverAtMs: nowMs + opts.backoffMs(env),
        });
        continue;
      }
      ready.push(env);
    }
    this.items = remain;
    return { ready, rescheduled, dead };
  }

  depth(): number {
    return this.items.length;
  }
}
