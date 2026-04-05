/** Robustness tuning — aligned with reference/python/config.py */

export const ACTIVE_HEARTBEAT_MS = 5000;
/** Remove peer after this much silence since last heartbeat (active → stale → dead). */
export const PEER_REMOVE_MS = 30_000;
export const RELAY_INSERTION_DISTANCE_STEP = 8;
export const STATE_SNAPSHOT_INTERVAL_MS = 30_000;
export const RELIABLE_MAX_ATTEMPTS = 3;
export const RELIABLE_BASE_DELAY_MS = 1000;
/** DISCOVER flood while isolated, before declaring solo anchor. */
export const DISCOVER_INTERVAL_TICKS = 3;
