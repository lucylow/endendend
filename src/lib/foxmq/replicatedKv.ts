type WatchHandler = (key: string, raw: string | null) => void;

export interface StoredBucket {
  [key: string]: string;
}

const STORAGE_KEY = "foxmq:swarm_kv";
const BC_NAME = "foxmq-swarm-replica";

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[FoxMQ:KV]", ...args);
};

function createBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(BC_NAME);
  } catch (e) {
    log("BroadcastChannel unavailable", e);
    return null;
  }
}

function loadBucket(): StoredBucket {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredBucket) : {};
  } catch {
    return {};
  }
}

function saveBucket(bucket: StoredBucket) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch (e) {
    log("persist failed", e);
  }
}

/**
 * In-process + localStorage + BroadcastChannel replica (browser / Lovable stand-in for a FoxMQ cluster).
 * Same-tab writes are synchronous; cross-tab uses storage events + BC.
 */
export class ReplicatedKV {
  private bucket: StoredBucket = loadBucket();
  private bc: BroadcastChannel | null = createBroadcastChannel();
  private watchers = new Map<string, Set<WatchHandler>>();

  constructor() {
    this.bc?.addEventListener("message", (ev: MessageEvent<{ bucket?: StoredBucket }>) => {
      if (ev.data?.bucket) {
        this.bucket = { ...ev.data.bucket };
        for (const key of Object.keys(this.bucket)) {
          this.notify(key, this.bucket[key] ?? null);
        }
      }
    });
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.bucket = JSON.parse(e.newValue) as StoredBucket;
            for (const key of Object.keys(this.bucket)) {
              this.notify(key, this.bucket[key] ?? null);
            }
          } catch {
            /* ignore */
          }
        }
      });
    }
  }

  get(key: string): string | null {
    return this.bucket[key] ?? null;
  }

  set(key: string, value: string) {
    this.bucket = { ...this.bucket, [key]: value };
    saveBucket(this.bucket);
    this.bc?.postMessage({ bucket: this.bucket });
    this.notify(key, value);
  }

  deleteKey(key: string) {
    const next = { ...this.bucket };
    delete next[key];
    this.bucket = next;
    saveBucket(this.bucket);
    this.bc?.postMessage({ bucket: this.bucket });
    this.notify(key, null);
  }

  clear() {
    this.bucket = {};
    saveBucket(this.bucket);
    this.bc?.postMessage({ bucket: this.bucket });
  }

  watch(key: string, fn: WatchHandler) {
    let set = this.watchers.get(key);
    if (!set) {
      set = new Set();
      this.watchers.set(key, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
    };
  }

  private notify(key: string, raw: string | null) {
    const set = this.watchers.get(key);
    if (!set) return;
    for (const fn of set) fn(key, raw);
  }
}

/** Process-wide singleton so every FoxMQClient shares one logical namespace. */
export const replicatedKv = new ReplicatedKV();
