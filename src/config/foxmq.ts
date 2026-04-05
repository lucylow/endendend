/**
 * FoxMQ-style distributed state settings (Tashi stack).
 * In production, point host/port at real FoxMQ brokers; the UI sim uses an in-process replica.
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
