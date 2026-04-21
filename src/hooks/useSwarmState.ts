import { useMemo } from "react";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

/** Memoized selectors for swarm dashboard widgets (simulation + ledger view). */
export function useSwarmState() {
  const view = useVertexSwarmStore((s) => s.view);
  const isRunning = useVertexSwarmStore((s) => s.isRunning);

  return useMemo(
    () => ({
      view,
      isRunning,
      map: view?.sharedMap ?? null,
      exploration: view?.exploration ?? [],
      discovery: view?.discovery ?? [],
      roles: view?.roleHandoffs ?? [],
      tasks: view?.tasks ?? [],
    }),
    [view, isRunning],
  );
}
