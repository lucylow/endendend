import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import { MonotonicSharedMap } from "@/swarm/sharedMap";
import type { MapCellMeta, SharedMapDelta } from "@/swarm/types";
import { mergePartitionMapDeltas } from "@/swarm/recoveryManager";
import { MapEventLedger } from "./mapLedger";
import { buildMapSnapshot, type MapSnapshot } from "./mapSnapshot";
import { buildMapDelta } from "./mapDelta";

export type FoxMqMapPublicState = {
  mapVersion: number;
  lastSnapshot: MapSnapshot;
  dirtyDeltaCount: number;
  syncLagMs: number;
  causalSeq: number;
  partitionBufferSize: number;
  recoveryProgress01: number;
  collectiveMemoryHealth01: number;
  mergeConflictsResolved: number;
  meshMergesThisTick: number;
  lastSyncPeer?: string;
  runtimeMode: "live" | "mock_fallback";
  liveFoxAvailable: boolean;
  offlineContributionsPreserved: Record<string, number>;
  ledgerEventCount: number;
  duplicateDeltasDropped: number;
};

export class FoxMqMapSyncEngine {
  readonly ledger = new MapEventLedger();
  private partitionBuffer: SharedMapDelta[] = [];
  private lastMeshMergeMs: number;
  private mergeConflictsResolved = 0;
  private causalSeq = 1;
  private seenPayloadChecksums = new Set<string>();
  private deltaSerial = 1;
  private duplicateDrops = 0;

  constructor(
    private readonly missionId: string,
    private readonly mapId: string,
    startMs: number,
  ) {
    this.lastMeshMergeMs = startMs;
  }

  reset(startMs: number): void {
    this.ledger.reset();
    this.partitionBuffer = [];
    this.mergeConflictsResolved = 0;
    this.causalSeq = 1;
    this.seenPayloadChecksums.clear();
    this.deltaSerial = 1;
    this.duplicateDrops = 0;
    this.lastMeshMergeMs = startMs;
  }

  private computeMapVersion(map: MonotonicSharedMap): number {
    let maxV = 0;
    for (const c of Object.values(map.snapshotCells())) {
      maxV = Math.max(maxV, c.version);
    }
    return Math.max(maxV, this.causalSeq);
  }

  private checksumDelta(delta: SharedMapDelta): string {
    const keys = Object.keys(delta.cells).sort();
    return `${keys.length}:${delta.originNodeId}:${delta.emittedAtMs}`;
  }

  step(args: {
    map: MonotonicSharedMap;
    graph: ConnectivitySnapshot;
    nowMs: number;
    rng: () => number;
    connectivityMode: VertexConnectivityMode;
    partitionManual: boolean;
    liveFoxAvailable: boolean;
    mockFallback: boolean;
    operatorNodeId: string;
    offlineNodeIds: string[];
  }): FoxMqMapPublicState {
    const partition =
      args.partitionManual ||
      args.connectivityMode === "partial_partition" ||
      args.connectivityMode === "blackout";

    let meshMerges = 0;
    let lastPeer: string | undefined;

    for (const e of args.graph.edges) {
      if (e.quality01 < 0.08) continue;
      const snap = args.map.snapshotCells();
      const keys = Object.keys(snap).filter((k) => {
        const c = args.map.getCell(k);
        return (
          c &&
          (c.state === "searched" ||
            c.state === "target" ||
            c.state === "frontier" ||
            c.state === "blocked" ||
            c.state === "hazard" ||
            c.state === "relay_critical" ||
            c.state === "unreachable")
        );
      });
      const sample = keys.slice(0, 6 + Math.floor(args.rng() * 6));
      if (sample.length < 2) continue;

      const rawDelta = args.map.exportDelta(sample, e.a, args.nowMs);
      const chksum = this.checksumDelta(rawDelta);
      if (this.seenPayloadChecksums.has(chksum)) {
        this.duplicateDrops += 1;
        continue;
      }
      this.seenPayloadChecksums.add(chksum);
      if (this.seenPayloadChecksums.size > 500) {
        const first = this.seenPayloadChecksums.values().next().value;
        if (first) this.seenPayloadChecksums.delete(first);
      }

      if (partition && args.rng() < 0.38) {
        this.partitionBuffer.push({ ...rawDelta, originNodeId: e.a });
        this.ledger.append({
          nodeId: e.a,
          eventType: "offline_buffer",
          affectedCells: Object.keys(rawDelta.cells),
          relayRoute: [e.a, e.b],
          commitStatus: "pending",
          mapVersion: this.causalSeq,
        });
        continue;
      }

      if (args.rng() > 0.55 + e.quality01 * 0.35) continue;

      const peerCells: Record<string, MapCellMeta> = {};
      for (const [k, v] of Object.entries(rawDelta.cells)) {
        peerCells[k] = { ...v, proofSource: "peer_mesh", dirtyLocal: false };
      }
      const before = args.map.snapshotCells();
      const { changedKeys } = args.map.mergeDelta({ cells: peerCells, originNodeId: e.b, emittedAtMs: args.nowMs });
      meshMerges += changedKeys.length;
      let conflict = 0;
      for (const k of changedKeys) {
        const prev = before[k];
        const next = args.map.getCell(k);
        if (prev && next && (prev.state !== next.state || prev.version !== next.version)) conflict += 1;
      }
      this.mergeConflictsResolved += conflict;
      lastPeer = e.b;
      this.lastMeshMergeMs = args.nowMs;
      this.causalSeq += 1;

      const built = buildMapDelta({
        deltaId: `d-${this.deltaSerial++}`,
        sourceNodeId: e.a,
        missionId: this.missionId,
        mapId: this.mapId,
        baseVersion: this.computeMapVersion(args.map),
        cells: rawDelta.cells,
        causalSeq: this.causalSeq,
        timestamp: args.nowMs,
      });

      this.ledger.append({
        nodeId: e.a,
        eventType: "map_delta",
        affectedCells: changedKeys,
        relayRoute: [e.a, e.b],
        commitStatus: "committed",
        mapVersion: built.causalSeq,
        payload: { deltaId: built.deltaId, checksum: built.checksum },
      });
    }

    if (!partition && this.partitionBuffer.length) {
      const mergedCells = mergePartitionMapDeltas(this.partitionBuffer);
      const beforeKeys = new Set(Object.keys(args.map.snapshotCells()));
      const { changedKeys } = args.map.mergeDelta({
        cells: mergedCells,
        originNodeId: args.operatorNodeId,
        emittedAtMs: args.nowMs,
      });
      meshMerges += changedKeys.length;
      this.mergeConflictsResolved += changedKeys.filter((k) => !beforeKeys.has(k)).length;
      this.ledger.append({
        nodeId: args.operatorNodeId,
        eventType: "recovery_merge",
        affectedCells: changedKeys,
        relayRoute: ["partition_buffer", args.operatorNodeId],
        commitStatus: "committed",
        mapVersion: ++this.causalSeq,
      });
      this.partitionBuffer = [];
      this.lastMeshMergeMs = args.nowMs;
    }

    const cells = args.map.snapshotCells();
    const mapVersion = this.computeMapVersion(args.map);
    const lastSnapshot = buildMapSnapshot({
      mapId: this.mapId,
      mapVersion,
      timestamp: args.nowMs,
      cells,
      lastSyncPeer: lastPeer,
      sourceLabels: args.mockFallback ? ["mock_foxmq", "mesh"] : ["live_foxmq", "mesh"],
    });

    const offlineSet = new Set(args.offlineNodeIds);
    const offlineContributionsPreserved: Record<string, number> = {};
    for (const [k, c] of Object.entries(cells)) {
      const owner = c.firstSeenBy ?? c.lastNodeId;
      if (!owner || !offlineSet.has(owner)) continue;
      offlineContributionsPreserved[owner] = (offlineContributionsPreserved[owner] ?? 0) + 1;
    }

    const syncLagMs = Math.max(0, args.nowMs - this.lastMeshMergeMs);
    const recoveryProgress01 = partition ? Math.min(1, 1 - this.partitionBuffer.length / 20) : 1;
    const collectiveMemoryHealth01 = Math.min(
      1,
      (meshMerges * 0.08 + (Object.keys(cells).length > 0 ? 0.35 : 0) + (args.offlineNodeIds.length ? 0.25 : 0.1)) /
        Math.max(0.4, 1),
    );

    return {
      mapVersion,
      lastSnapshot,
      dirtyDeltaCount: lastSnapshot.dirtyDeltaCount,
      syncLagMs,
      causalSeq: this.causalSeq,
      partitionBufferSize: this.partitionBuffer.length,
      recoveryProgress01,
      collectiveMemoryHealth01,
      mergeConflictsResolved: this.mergeConflictsResolved,
      meshMergesThisTick: meshMerges,
      lastSyncPeer: lastPeer,
      runtimeMode: args.mockFallback ? "mock_fallback" : "live",
      liveFoxAvailable: args.liveFoxAvailable,
      offlineContributionsPreserved,
      ledgerEventCount: this.ledger.all().length,
      duplicateDeltasDropped: this.duplicateDrops,
    };
  }
}
