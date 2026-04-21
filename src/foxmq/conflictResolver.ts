import type { MapCellMeta } from "@/swarm/types";
import { mergeMapCellMeta } from "./mapMerge";

/** Public merge entry — same semantics as mesh ingestion. */
export function resolveCellConflict(local: MapCellMeta | undefined, remote: MapCellMeta, origin: string): MapCellMeta {
  return mergeMapCellMeta(local, remote, origin);
}
