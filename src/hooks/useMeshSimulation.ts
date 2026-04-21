import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

/** Controls that stress or repair the modular mesh survival layer. */
export function useMeshSimulation() {
  const meshInjectPacketLoss = useVertexSwarmStore((s) => s.meshInjectPacketLoss);
  const meshInjectLatency = useVertexSwarmStore((s) => s.meshInjectLatency);
  const meshTogglePartition = useVertexSwarmStore((s) => s.meshTogglePartition);
  const meshResetStress = useVertexSwarmStore((s) => s.meshResetStress);
  const meshSetStressPreset = useVertexSwarmStore((s) => s.meshSetStressPreset);
  const meshForceRelayNomination = useVertexSwarmStore((s) => s.meshForceRelayNomination);
  const start = useVertexSwarmStore((s) => s.start);
  const pause = useVertexSwarmStore((s) => s.pause);
  const stepOnce = useVertexSwarmStore((s) => s.stepOnce);
  const reset = useVertexSwarmStore((s) => s.reset);
  const setUseMockFallback = useVertexSwarmStore((s) => s.setUseMockFallback);
  return {
    meshInjectPacketLoss,
    meshInjectLatency,
    meshTogglePartition,
    meshResetStress,
    meshSetStressPreset,
    meshForceRelayNomination,
    start,
    pause,
    stepOnce,
    reset,
    setUseMockFallback,
  };
}
