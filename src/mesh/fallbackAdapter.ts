import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import type { MeshSurvivalPublicView } from "./types";

/** Bridges full simulator view with mesh survival slice for dashboards that accept either shape. */
export function pickMeshSurvivalView(view: VertexSwarmView | null): MeshSurvivalPublicView | null {
  return view?.meshSurvival ?? null;
}
