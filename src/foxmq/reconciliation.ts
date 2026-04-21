import type { MapCellMeta } from "@/swarm/types";
import type { SharedMapDelta } from "@/swarm/types";
import { mergePartitionMapDeltas } from "@/swarm/recoveryManager";

/** Merge buffered partition deltas into one collective-safe map fragment. */
export function reconcilePartitionDeltas(buffers: SharedMapDelta[]): Record<string, MapCellMeta> {
  return mergePartitionMapDeltas(buffers);
}
