/**
 * FoxMQ-style distributed state settings (Tashi stack).
 * Lovable / Vite: set `VITE_FOXMQ_*` in project env; defaults keep the demo runnable with no broker.
 */
export const FOXMQ_HOST = import.meta.env.VITE_FOXMQ_HOST ?? "localhost";
export const FOXMQ_PORT = Number(import.meta.env.VITE_FOXMQ_PORT ?? 7000);
export const FOXMQ_CLUSTER_NAME = import.meta.env.VITE_FOXMQ_CLUSTER_NAME ?? "swarm";
export const FOXMQ_REPLICATION_FACTOR = Number(import.meta.env.VITE_FOXMQ_REPLICATION_FACTOR ?? 3);
/** Shared secret for Put/CAS when non-empty (client-side check + persisted flag). */
export const FOXMQ_AUTH_TOKEN = import.meta.env.VITE_FOXMQ_AUTH_TOKEN ?? "";

export const FOXMQ_WORLD_MAP_KEY = "world_map";
export const FOXMQ_COMMIT_INTERVAL_MS = 5000;
export const FOXMQ_CAS_MAX_ATTEMPTS = 8;

export type FoxmqClientConfig = {
  host: string;
  port: number;
  clusterName: string;
  replicationFactor: number;
  authToken: string;
};

/** Single snapshot for constructing the FoxMQ client (browser replica or future native adapter). */
export function readFoxmqClientConfig(): FoxmqClientConfig {
  return {
    host: FOXMQ_HOST,
    port: FOXMQ_PORT,
    clusterName: FOXMQ_CLUSTER_NAME,
    replicationFactor: FOXMQ_REPLICATION_FACTOR,
    authToken: FOXMQ_AUTH_TOKEN,
  };
}
