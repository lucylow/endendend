import { FoxMqMapSyncEngine, type FoxMqMapPublicState } from "./mapSyncEngine";
import type { MonotonicSharedMap } from "@/swarm/sharedMap";
import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";

export type MockFoxMqTickArgs = {
  map: MonotonicSharedMap;
  graph: ConnectivitySnapshot;
  nowMs: number;
  rng: () => number;
  connectivityMode: VertexConnectivityMode;
  partitionManual: boolean;
  mockFallback: boolean;
  liveFoxAvailable: boolean;
  operatorNodeId: string;
  offlineNodeIds: string[];
};

/**
 * Deterministic browser stand-in when no native FoxMQ broker is linked — same {@link FoxMqMapPublicState} shape as live.
 */
export class MockFoxMqRuntime {
  readonly engine: FoxMqMapSyncEngine;

  constructor(missionId: string, mapId: string, startMs: number) {
    this.engine = new FoxMqMapSyncEngine(missionId, mapId, startMs);
  }

  tick(args: MockFoxMqTickArgs): FoxMqMapPublicState {
    return this.engine.step({
      ...args,
      liveFoxAvailable: args.liveFoxAvailable,
    });
  }
}
