import { useMemo } from "react";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import { coveragePct, dirtyCount } from "@/foxmq/selectors";

/** Shared grid + FoxMQ projection + ledger tail for map-centric dashboards. */
export function useDistributedMap() {
  const view = useVertexSwarmStore((s) => s.view);
  return useMemo(() => {
    const cells = view?.sharedMap.cells ?? {};
    const foxBlock = view?.foxmqMap;
    return {
      cells,
      fox: foxBlock?.public ?? null,
      scenarioProfile: foxBlock?.scenarioProfile ?? null,
      ledgerTail: foxBlock?.ledgerTail ?? [],
      coveragePct: coveragePct(cells),
      dirtyCells: dirtyCount(cells),
      mapVersion: foxBlock?.public.mapVersion ?? 0,
    };
  }, [view]);
}
