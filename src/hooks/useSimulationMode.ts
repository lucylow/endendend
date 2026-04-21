import { useShallow } from "zustand/react/shallow";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

export function useSimulationMode() {
  return useVertexSwarmStore(
    useShallow((s) => ({
      isRunning: s.isRunning,
      useMockFallback: s.useMockFallback,
      simSpeed: s.simSpeed,
      setUseMockFallback: s.setUseMockFallback,
      setSimSpeed: s.setSimSpeed,
    })),
  );
}
