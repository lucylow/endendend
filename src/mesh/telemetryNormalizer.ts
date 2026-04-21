import type { SimTelemetrySample } from "@/backend/vertex/swarm-types";
import type { MeshPeerRichProfile } from "./types";

export type NormalizedMeshTelemetry = {
  raw: SimTelemetrySample;
  nodeId: string;
  link01: number;
  queueDepth: number;
  duplicate: boolean;
  sourceLabel: "sim" | "live" | "unknown";
};

export function normalizeTelemetryBatch(samples: SimTelemetrySample[], sourceLabel: NormalizedMeshTelemetry["sourceLabel"]): NormalizedMeshTelemetry[] {
  return samples.map((raw) => ({
    raw,
    nodeId: raw.nodeId,
    link01: typeof raw.link01 === "number" && !Number.isNaN(raw.link01) ? Math.max(0, Math.min(1, raw.link01)) : 0.4,
    queueDepth: Math.max(0, Math.floor(raw.queueDepth ?? 0)),
    duplicate: Boolean(raw.duplicate),
    sourceLabel,
  }));
}

export function applyTelemetryToProfiles(profiles: MeshPeerRichProfile[], norm: NormalizedMeshTelemetry[]): MeshPeerRichProfile[] {
  const byId = new Map(norm.map((n) => [n.nodeId, n]));
  return profiles.map((p) => {
    const t = byId.get(p.nodeId);
    if (!t) return p;
    const degraded = t.link01 < 0.25 || t.duplicate;
    return {
      ...p,
      battery01: t.raw.battery01,
      localQueueDepth: t.queueDepth,
      connectivityState: degraded ? "degraded" : p.connectivityState,
    };
  });
}
