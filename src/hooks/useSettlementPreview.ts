import { useRuntimeStore } from "@/lib/state/runtimeStore";

export function useSettlementPreview() {
  return useRuntimeStore((s) => ({
    preview: s.settlementPreview,
    sealSettlement: s.sealSettlement,
    flat: s.flatEnvelope,
  }));
}
