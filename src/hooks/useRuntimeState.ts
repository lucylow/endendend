import { useRuntimeStore } from "@/lib/state/runtimeStore";

/** Core runtime fields for layout shells. */
export function useRuntimeState() {
  return useRuntimeStore((s) => ({
    flatEnvelope: s.flatEnvelope,
    transport: s.transport,
    loading: s.loading,
    connection: s.connection,
    lastActionError: s.lastActionError,
    tasks: s.tasks,
    rewards: s.rewards,
    mapModel: s.mapModel,
    settlementPreview: s.settlementPreview,
    lastSwarmSnapshot: s.lastSwarmSnapshot,
  }));
}
