import {
  FOXMQ_AUTH_TOKEN,
  FOXMQ_CLUSTER_NAME,
  FOXMQ_HOST,
  FOXMQ_PORT,
  FOXMQ_REPLICATION_FACTOR,
} from "@/config/foxmq";

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[FoxMQ]", ...args);
};

type WatchHandler = (key: string, raw: string | null) => void;

function stableStringifyCells(cells: [number, number][]): string {
  const sorted = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return JSON.stringify(sorted);
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Serializes values for storage; surfaces clear errors instead of opaque JSON failures. */
function stringifyValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`FoxMQ: cannot serialize value (${detail})`);
  }
}

const STORAGE_KEY = "foxmq:swarm_kv";
const BC_NAME = "foxmq-swarm-replica";

function createBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(BC_NAME);
  } catch (e) {
    log("BroadcastChannel unavailable", e);
    return null;
  }
}

interface StoredBucket {
  [key: string]: string;
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

/** In-process + localStorage + BroadcastChannel replica (hackathon stand-in for FoxMQ cluster). */
class ReplicatedKV {
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

const replica = new ReplicatedKV();

export type FoxMQPutOptions = { ttl?: number; token?: string };

/**
 * FoxMQ client wrapper. Uses a replicated KV when the native `foxmq` module is absent
 * (browser / demo). Swap `connect()` for a real broker client when available.
 */
export class FoxMQClient {
  readonly nodeId: string;
  host: string;
  port: number;
  clusterName: string;
  replicationFactor: number;
  connected = false;
  private unsubscribes: Array<() => void> = [];
  private keyCallbacks = new Map<string, Set<(key: string, value: unknown) => void>>();

  constructor(
    nodeId: string,
    opts?: { host?: string; port?: number; clusterName?: string; replicationFactor?: number },
  ) {
    this.nodeId = nodeId;
    this.host = opts?.host ?? FOXMQ_HOST;
    this.port = opts?.port ?? FOXMQ_PORT;
    this.clusterName = opts?.clusterName ?? FOXMQ_CLUSTER_NAME;
    this.replicationFactor = opts?.replicationFactor ?? FOXMQ_REPLICATION_FACTOR;
  }

  connect(): void {
    this.connected = true;
    log(`connected ${this.nodeId} → ${this.host}:${this.port} cluster=${this.clusterName} rf=${this.replicationFactor}`);
  }

  disconnect(): void {
    for (const u of this.unsubscribes) u();
    this.unsubscribes = [];
    this.connected = false;
  }

  private assertAuth(token?: string) {
    if (!FOXMQ_AUTH_TOKEN) return;
    if (token !== FOXMQ_AUTH_TOKEN) {
      throw new Error("FoxMQ: unauthorized put — invalid or missing token");
    }
  }

  put(key: string, value: unknown, opts?: FoxMQPutOptions): void {
    if (!this.connected) throw new Error("FoxMQ: not connected");
    this.assertAuth(opts?.token);
    replica.set(key, stringifyValue(value));
  }

  get<T>(key: string, defaultValue: T): T {
    if (!this.connected) return defaultValue;
    const raw = replica.get(key);
    return parseJson<T>(raw, defaultValue);
  }

  /**
   * Compare-and-swap on JSON equality of values (order-normalized for cell lists).
   */
  compareAndSwap(key: string, expected: unknown, next: unknown, opts?: FoxMQPutOptions): boolean {
    if (!this.connected) return false;
    this.assertAuth(opts?.token);
    const raw = replica.get(key);
    const current = parseJson<unknown>(raw, []);
    const expNorm =
      Array.isArray(expected) && expected.length && Array.isArray(expected[0])
        ? stableStringifyCells(expected as [number, number][])
        : JSON.stringify(expected);
    const curNorm =
      Array.isArray(current) && current.length && Array.isArray((current as [number, number][])[0])
        ? stableStringifyCells(current as [number, number][])
        : JSON.stringify(current);
    if (curNorm !== expNorm) return false;
    replica.set(key, stringifyValue(next));
    return true;
  }

  subscribe(key: string, callback: (key: string, value: unknown) => void): void {
    if (!this.connected) return;
    let set = this.keyCallbacks.get(key);
    if (!set) {
      set = new Set();
      this.keyCallbacks.set(key, set);
    }
    set.add(callback);

    const unw = replica.watch(key, (k, data) => {
      const value = parseJson<unknown>(data, null);
      callback(k, value);
    });
    this.unsubscribes.push(unw);
  }

  /** Test / reset helper — clears replicated namespace (all tabs after broadcast). */
  clearAll(): void {
    replica.clear();
  }
}

export function createDroneNodeId(): string {
  if (typeof sessionStorage === "undefined") return `drone-${Math.random().toString(36).slice(2, 9)}`;
  try {
    let id = sessionStorage.getItem("foxmq_drone_node_id");
    if (!id) {
      id = `drone-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("foxmq_drone_node_id", id);
    }
    return id;
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[FoxMQ] sessionStorage unavailable, ephemeral node id", e);
    return `drone-${Math.random().toString(36).slice(2, 9)}`;
  }
}
