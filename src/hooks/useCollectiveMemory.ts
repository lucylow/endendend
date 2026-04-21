import { useMemo } from "react";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

/** Offline retention + ledger-derived collective memory signals. */
export function useCollectiveMemory() {
  const view = useVertexSwarmStore((s) => s.view);
  return useMemo(() => {
    const fox = view?.foxmqMap?.public;
    const offline = view?.nodes?.filter((n) => n.offline).map((n) => n.nodeId) ?? [];
    const preserved = fox?.offlineContributionsPreserved ?? {};
    return {
      offlineNodeIds: offline,
      offlineContributionsPreserved: preserved,
      ledgerEvents: view?.foxmqMap?.ledgerTail?.length ?? 0,
      duplicateDeltasDropped: fox?.duplicateDeltasDropped ?? 0,
    };
  }, [view]);
}
