import type { MeshConsolidatedEvent } from "./types";

export function buildMeshReplayNarrative(events: MeshConsolidatedEvent[]): { atMs: number; label: string; detail: string; severity: "info" | "warn" | "critical" }[] {
  return events.slice(-40).map((e) => ({
    atMs: e.atMs,
    label: e.kind,
    detail: e.summary,
    severity: e.severity,
  }));
}
