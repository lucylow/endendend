import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

export function useSimulationMode() {
  return useVertexSwarmStore((s) => ({
    isRunning: s.isRunning,
    useMockFallback: s.useMockFallback,
    simSpeed: s.simSpeed,
    setUseMockFallback: s.setUseMockFallback,
    setSimSpeed: s.setSimSpeed,
  }));
}
