import { normalizeMapGridFromCells } from "@/lib/state/normalizers";
import type { DataSource } from "@/lib/state/types";

export function mapOverviewFromExploredCells(explored: number, missionId: string, source: DataSource) {
  return normalizeMapGridFromCells(explored, `map|${missionId}`, source);
}
