import { useShallow } from "zustand/react/shallow";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

/** Derived network stress indicators for dashboards and HUDs. */
export function useNetworkStress() {
  return useVertexSwarmStore(
    useShallow((s) => {
      const view = s.view;
      const ms = view?.meshSurvival;
      const v2 = view?.meshV2;
      return {
        connectivityMode: view?.connectivityMode ?? null,
        constraintMode: ms?.constraintMode ?? null,
        vertexStress: ms?.vertexStress ?? v2?.stressMode ?? null,
        blackoutActive: view?.blackoutActive ?? false,
        busStats: ms?.bus.stats ?? null,
        recovery: ms?.recovery ?? null,
      };
    }),
  );
}
