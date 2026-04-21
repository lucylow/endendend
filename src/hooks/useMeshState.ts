import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import type { MeshSurvivalPublicView } from "@/mesh/types";

/** Mesh survival slice from the Vertex swarm view (null before first tick). */
export function useMeshState(): MeshSurvivalPublicView | null {
  return useVertexSwarmStore((s) => s.view?.meshSurvival ?? null);
}
