import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";

const KEY = "tashi-runtime-checkpoint-v1";

export type CheckpointPayload = {
  missionId: string;
  scenario: MissionScenarioKind;
  events: MissionLedgerEvent[];
  savedAtMs: number;
};

export function saveCheckpoint(payload: CheckpointPayload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[checkpoint] save failed", e);
  }
}

export function loadCheckpoint(): CheckpointPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CheckpointPayload;
    if (!p?.missionId || !Array.isArray(p.events)) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearCheckpoint(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
