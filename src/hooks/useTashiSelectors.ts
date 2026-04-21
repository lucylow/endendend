import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import type { FlatMissionEnvelope } from "@/lib/state/types";

export function useTashiEnvelope(): FlatMissionEnvelope | null {
  return useVertexSwarmStore((st) => st.flatEnvelope);
}

export function useNodes(): FlatMissionEnvelope["nodes"] {
  return useVertexSwarmStore((st) => st.flatEnvelope?.nodes ?? []);
}

export function useMapSummary(): FlatMissionEnvelope["mapSummary"] | null {
  return useVertexSwarmStore((st) => st.flatEnvelope?.mapSummary ?? null);
}

export function useAlerts(): FlatMissionEnvelope["alerts"] {
  return useVertexSwarmStore((st) => st.flatEnvelope?.alerts ?? []);
}

export function useTargets(): FlatMissionEnvelope["mapSummary"]["targets"] {
  return useVertexSwarmStore((st) => st.flatEnvelope?.mapSummary.targets ?? []);
}
