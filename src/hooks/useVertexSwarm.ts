import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

/** Live Vertex 2.0 swarm simulator view + controls (mock-capable). */
export function useVertexSwarm() {
  return useVertexSwarmStore();
}
