import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

export function useNetworkStress() {
  const mesh = useVertexSwarmStore((s) => s.view?.meshV2 ?? null);
  const connectivity = useVertexSwarmStore((s) => s.view?.connectivityMode ?? "normal");
  return {
    stressMode: mesh?.stressMode ?? "normal",
    connectivityMode: connectivity,
    consensusHealth: mesh?.consensus.health ?? null,
    stats: mesh?.stats ?? null,
  };
}
