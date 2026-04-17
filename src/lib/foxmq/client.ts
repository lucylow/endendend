import { FOXMQ_AUTH_TOKEN, readFoxmqClientConfig } from "@/config/foxmq";
import { replicatedKv } from "./replicatedKv";
import type { FoxMQClientOptions, FoxMQPutOptions, FoxMQRuntimeInfo } from "./types";

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.debug("[FoxMQ]", ...args);
};

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

function stringifyValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`FoxMQ: cannot serialize value (${detail})`);
  }
}

/**
 * FoxMQ client for the Vite / browser build: replicated KV when no native broker is linked.
 * Configure via `VITE_FOXMQ_*` in Lovable env — same as local `.env`.
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

  constructor(nodeId: string, opts?: FoxMQClientOptions) {
    const base = readFoxmqClientConfig();
    this.nodeId = nodeId;
    this.host = opts?.host ?? base.host;
    this.port = opts?.port ?? base.port;
    this.clusterName = opts?.clusterName ?? base.clusterName;
    this.replicationFactor = opts?.replicationFactor ?? base.replicationFactor;
  }

  getRuntimeInfo(): FoxMQRuntimeInfo {
    return {
      mode: "browser-replica",
      host: this.host,
      port: this.port,
      clusterName: this.clusterName,
      replicationFactor: this.replicationFactor,
    };
  }

  connect(): void {
    this.connected = true;
    log(`connected ${this.nodeId} → ${this.host}:${this.port} cluster=${this.clusterName} rf=${this.replicationFactor}`);
  }

  disconnect(): void {
    for (const u of this.unsubscribes) u();
    this.unsubscribes = [];
    this.keyCallbacks.clear();
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
    replicatedKv.set(key, stringifyValue(value));
  }

  get<T>(key: string, defaultValue: T): T {
    if (!this.connected) return defaultValue;
    const raw = replicatedKv.get(key);
    return parseJson<T>(raw, defaultValue);
  }

  /**
   * Compare-and-swap on JSON equality of values (order-normalized for cell lists).
   */
  compareAndSwap(key: string, expected: unknown, next: unknown, opts?: FoxMQPutOptions): boolean {
    if (!this.connected) return false;
    this.assertAuth(opts?.token);
    const raw = replicatedKv.get(key);
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
    replicatedKv.set(key, stringifyValue(next));
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

    const unw = replicatedKv.watch(key, (k, data) => {
      const value = parseJson<unknown>(data, null);
      callback(k, value);
    });
    this.unsubscribes.push(unw);
  }

  /** Test / reset helper — clears replicated namespace (all tabs after broadcast). */
  clearAll(): void {
    replicatedKv.clear();
  }
}
