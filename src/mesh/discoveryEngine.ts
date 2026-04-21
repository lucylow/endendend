import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { NetworkStressMode } from "@/vertex2/types";
import type { DiscoveryPeerState } from "./types";

export type DiscoveryKey = `${string}→${string}`;

export type DiscoveryCell = {
  observerId: string;
  targetId: string;
  state: DiscoveryPeerState;
  sightings: number;
  ticksSinceSighting: number;
  viaRelay?: string;
};

const STALE_TICKS = 6;
const LOST_TICKS = 14;
const CONFIRM_SIGHTINGS = 3;

function edgeBetween(snap: ConnectivitySnapshot, a: string, b: string) {
  return snap.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

function neighborsOf(id: string, snap: ConnectivitySnapshot): string[] {
  const out: string[] = [];
  for (const e of snap.edges) {
    if (e.a === id) out.push(e.b);
    else if (e.b === id) out.push(e.a);
  }
  return out;
}

/**
 * Gradual, stress-aware discovery: direct sightings plus rare relay-assisted hints.
 */
export function advanceDiscoveryRegistry(args: {
  snap: ConnectivitySnapshot;
  observerIds: string[];
  stress: NetworkStressMode;
  loss01: number;
  rng: () => number;
  cells: Map<string, DiscoveryCell>;
}): void {
  const { snap, observerIds, stress, loss01, rng, cells } = args;
  const speed =
    stress === "normal"
      ? 0.92
      : stress === "degraded"
        ? 0.78
        : stress === "high_latency"
          ? 0.62
          : stress === "lossy"
            ? 0.52
            : stress === "partitioned"
              ? 0.58
              : stress === "recovery"
                ? 0.72
                : 0.45;

  for (const obs of observerIds) {
    if (snap.stalePeers.has(obs)) continue;
    const nbrs = neighborsOf(obs, snap);
    const secondHop = new Map<string, string>();
    for (const n of nbrs) {
      for (const m of neighborsOf(n, snap)) {
        if (m === obs) continue;
        if (!secondHop.has(m)) secondHop.set(m, n);
      }
    }

    const candidates = new Set<string>([...nbrs, ...secondHop.keys()]);
    for (const target of candidates) {
      if (target === obs) continue;
      const key = `${obs}→${target}` as DiscoveryKey;
      const edge = edgeBetween(snap, obs, target);
      const relayHint = edge ? undefined : secondHop.get(target);
      const baseQual = edge?.quality01 ?? (relayHint ? 0.35 : 0);
      const sightingChance = speed * baseQual * (1 - loss01 * 0.65) * (edge ? 1 : 0.22);

      let cell = cells.get(key);
      if (!cell) {
        cell = { observerId: obs, targetId: target, state: "unknown", sightings: 0, ticksSinceSighting: 99 };
        cells.set(key, cell);
      }

      cell.ticksSinceSighting += 1;

      const saw = rng() < sightingChance;
      if (saw) {
        cell.sightings += 1;
        cell.ticksSinceSighting = 0;
        if (relayHint && !edge) cell.viaRelay = relayHint;
        if (edge) cell.viaRelay = undefined;
      }

      if (cell.ticksSinceSighting === 0) {
        if (cell.sightings >= CONFIRM_SIGHTINGS) cell.state = cell.state === "lost" ? "recovered" : "confirmed";
        else if (cell.sightings === 1) cell.state = "suspected";
        else if (cell.sightings >= 2) cell.state = "discovered";
      } else {
        if (cell.state !== "unknown" && cell.ticksSinceSighting > STALE_TICKS) cell.state = "stale";
        if (cell.state !== "unknown" && cell.ticksSinceSighting > LOST_TICKS) cell.state = "lost";
      }

      // Speculative gossip: rarely mark suspected from relay-only whispers
      if (!saw && relayHint && rng() < 0.04 * speed && cell.state === "unknown") {
        cell.state = "suspected";
        cell.viaRelay = relayHint;
      }
    }
  }
}

export function discoveryEntries(cells: Map<string, DiscoveryCell>): DiscoveryCell[] {
  return [...cells.values()].filter((c) => c.state !== "unknown").slice(-220);
}
