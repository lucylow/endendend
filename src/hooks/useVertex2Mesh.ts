import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

/** Vertex 2.0 mesh resilience view derived from the swarm simulator tick. */
export function useVertex2Mesh() {
  const mesh = useVertexSwarmStore((s) => s.view?.meshV2 ?? null);
  return mesh;
}
