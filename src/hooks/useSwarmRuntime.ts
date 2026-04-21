import { useMemo } from "react";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import { normalizeSwarmView } from "@/swarm/stateNormalizer";
import { buildCoordinationSnapshot } from "@/swarm/coordinationEngine";

/** Normalized swarm UI + coordination snapshot + raw simulator view. */
export function useSwarmRuntime() {
  const view = useVertexSwarmStore((s) => s.view);
  const runtimeEvents = useVertexSwarmStore((s) => s.runtimeEvents);

  return useMemo(
    () => ({
      view,
      normalized: normalizeSwarmView(view),
      coordination: buildCoordinationSnapshot(view),
      runtimeEvents,
    }),
    [view, runtimeEvents],
  );
}
