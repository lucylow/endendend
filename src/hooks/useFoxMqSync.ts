import { useMemo } from "react";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import { collectiveMemoryHealth, mergeConflictsResolved, recoveryProgress, syncLagMs } from "@/foxmq/selectors";

export function useFoxMqSync() {
  const view = useVertexSwarmStore((s) => s.view);
  return useMemo(() => {
    const p = view?.foxmqMap?.public;
    return {
      mapVersion: p?.mapVersion ?? 0,
      dirtyDeltaCount: p?.dirtyDeltaCount ?? 0,
      syncLagMs: syncLagMs(p),
      partitionBuffer: p?.partitionBufferSize ?? 0,
      meshMergesThisTick: p?.meshMergesThisTick ?? 0,
      recoveryPct: recoveryProgress(p),
      collectiveHealthPct: collectiveMemoryHealth(p),
      mergeConflicts: mergeConflictsResolved(p),
      runtimeMode: p?.runtimeMode ?? "mock_fallback",
      liveFoxAvailable: p?.liveFoxAvailable ?? false,
      lastSyncPeer: p?.lastSyncPeer,
    };
  }, [view]);
}
