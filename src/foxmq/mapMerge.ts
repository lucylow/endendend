import type { MapCellMeta, MapCellState, MapProofSource } from "@/swarm/types";

/** Exploration progression — higher means more world knowledge committed to the fleet. */
const STATE_RANK: Record<MapCellState, number> = {
  unknown: 0,
  frontier: 1,
  seen: 2,
  searched: 3,
  safe: 4,
  relay_critical: 5,
  blocked: 6,
  hazard: 7,
  unreachable: 8,
  target: 9,
};

const PROOF_TRUST: Record<MapProofSource, number> = {
  local_sensor: 1,
  peer_mesh: 2,
  recovery: 2,
  replay: 2,
  operator: 3,
  peer_confirm: 4,
};

const LINEAGE_CAP = 6;

function rankOf(m: MapCellMeta): number {
  return STATE_RANK[m.state] ?? 0;
}

function trustOf(m: MapCellMeta): number {
  return m.proofSource ? PROOF_TRUST[m.proofSource] ?? 1 : 1;
}

function appendLineage(base: string[] | undefined, entry: string): string[] {
  const next = [...(base ?? []), entry];
  return next.slice(-LINEAGE_CAP);
}

/**
 * Monotonic, merge-safe cell join. Stale lower-rank evidence cannot erase fleet knowledge
 * (e.g. a delayed "seen" cannot revert a committed "searched").
 */
export function mergeMapCellMeta(local: MapCellMeta | undefined, remote: MapCellMeta, remoteOrigin: string): MapCellMeta {
  if (!local) {
    return {
      ...remote,
      mergeLineage: appendLineage(remote.mergeLineage, `init≤${remoteOrigin}`),
      dirtyLocal: remote.dirtyLocal ?? false,
    };
  }

  const lr = rankOf(local);
  const rr = rankOf(remote);

  if (rr > lr) {
    return {
      ...remote,
      firstSeenBy: local.firstSeenBy ?? remote.firstSeenBy,
      mergeLineage: appendLineage(local.mergeLineage, `rank↑${remoteOrigin}`),
      dirtyLocal: remote.dirtyLocal ?? false,
    };
  }
  if (rr < lr) {
    return {
      ...local,
      mergeLineage: appendLineage(local.mergeLineage, `reject-stale-rank:${remoteOrigin}`),
    };
  }

  // Same rank — version, time, confidence, proof trust
  if (remote.version > local.version) {
    return {
      ...remote,
      firstSeenBy: local.firstSeenBy ?? remote.firstSeenBy,
      mergeLineage: appendLineage(local.mergeLineage, `ver↑${remoteOrigin}`),
      confidence01: Math.max(local.confidence01 ?? 0, remote.confidence01 ?? 0),
      dirtyLocal: (remote.dirtyLocal ?? false) || (local.dirtyLocal ?? false),
    };
  }
  if (remote.version < local.version) {
    return {
      ...local,
      mergeLineage: appendLineage(local.mergeLineage, `keep-ver:${remoteOrigin}`),
    };
  }

  if (remote.updatedAtMs > local.updatedAtMs) {
    return {
      ...remote,
      proofSource: trustOf(remote) >= trustOf(local) ? remote.proofSource ?? local.proofSource : local.proofSource,
      firstSeenBy: local.firstSeenBy ?? remote.firstSeenBy,
      confidence01: Math.max(local.confidence01 ?? 0, remote.confidence01 ?? 0),
      mergeLineage: appendLineage(local.mergeLineage, `time↑${remoteOrigin}`),
      dirtyLocal: (remote.dirtyLocal ?? false) || (local.dirtyLocal ?? false),
    };
  }
  if (remote.updatedAtMs < local.updatedAtMs) {
    return { ...local, mergeLineage: appendLineage(local.mergeLineage, `keep-time:${remoteOrigin}`) };
  }

  const rc = remote.confidence01 ?? 0;
  const lc = local.confidence01 ?? 0;
  if (rc > lc) {
    return {
      ...local,
      confidence01: rc,
      proofSource: trustOf(remote) >= trustOf(local) ? remote.proofSource ?? local.proofSource : local.proofSource,
      mergeLineage: appendLineage(local.mergeLineage, `conf↑${remoteOrigin}`),
    };
  }

  if (trustOf(remote) > trustOf(local)) {
    return {
      ...local,
      proofSource: remote.proofSource,
      lastNodeId: remote.lastNodeId ?? local.lastNodeId,
      mergeLineage: appendLineage(local.mergeLineage, `trust↑${remoteOrigin}`),
    };
  }

  return { ...local, mergeLineage: appendLineage(local.mergeLineage, `tie:${remoteOrigin}`) };
}

export function cellStateRank(state: MapCellState): number {
  return STATE_RANK[state] ?? 0;
}

/** @deprecated Prefer {@link cellStateRank} — kept for swarm module compatibility. */
export const CELL_RANK = STATE_RANK;
