import type { AgentTelemetry } from "@/types/websocket";

/**
 * Merge telemetry from multiple gateway WebSockets: latest `serverTimeMs` wins per agent.
 * Flags conflict when peers disagree on role at similar timestamps (possible Byzantine / partition).
 */
export function mergeTelemetryFromPeers(batches: AgentTelemetry[][]): {
  merged: AgentTelemetry[];
  hasConflict: boolean;
} {
  const byId = new Map<string, AgentTelemetry[]>();
  for (const batch of batches) {
    for (const t of batch) {
      const cur = byId.get(t.id);
      if (cur) cur.push(t);
      else byId.set(t.id, [t]);
    }
  }

  let hasConflict = false;
  const merged: AgentTelemetry[] = [];

  for (const [, samples] of byId) {
    if (samples.length === 0) continue;
    const sorted = [...samples].sort((a, b) => (b.serverTimeMs ?? 0) - (a.serverTimeMs ?? 0));
    const best = sorted[0]!;
    merged.push(best);

    const t0 = best.serverTimeMs ?? 0;
    for (let i = 1; i < sorted.length; i++) {
      const o = sorted[i]!;
      const dt = Math.abs((o.serverTimeMs ?? 0) - t0);
      if (dt < 80 && o.role !== best.role) {
        hasConflict = true;
        break;
      }
    }
  }

  merged.sort((a, b) => a.id.localeCompare(b.id));
  return { merged, hasConflict };
}
