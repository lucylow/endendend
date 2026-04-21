import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import type { DataSource } from "@/lib/state/types";
import { tasksFromEnvelope } from "@/lib/state/normalizers";

export function listTasksForEnvelope(env: TashiStateEnvelope | null, source: DataSource) {
  if (!env) return [];
  return tasksFromEnvelope(env, source);
}
