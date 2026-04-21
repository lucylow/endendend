import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

export function useBlackoutMode() {
  const view = useVertexSwarmStore((s) => s.view);
  const mode = view?.connectivityMode ?? "normal";
  const active = view?.blackoutActive ?? false;
  return {
    connectivityMode: mode,
    blackoutActive: active,
    label:
      mode === "blackout"
        ? "Full blackout"
        : mode === "partial_partition"
          ? "Partial partition"
          : mode === "degraded"
            ? "Degraded link"
            : mode === "recovery"
              ? "Recovery"
              : mode === "resync"
                ? "Resync"
                : "Normal",
  };
}
