import type { BlackoutSeverity } from "./swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import { ConnectivityGraph } from "./connectivity-graph";
import type { GraphEdge } from "./swarm-types";

export type BlackoutState = {
  active: boolean;
  severity: BlackoutSeverity | null;
  startedAtMs: number | null;
  endsAtMs: number | null;
};

/** Injects link loss, delay variance, and partition stress onto a connectivity graph. */
export class BlackoutSimulator {
  private state: BlackoutState = { active: false, severity: null, startedAtMs: null, endsAtMs: null };

  getState(): BlackoutState {
    return { ...this.state };
  }

  vertexModeFromBlackout(): VertexConnectivityMode {
    if (!this.state.active) return "normal";
    if (this.state.severity === "full") return "blackout";
    if (this.state.severity === "partial") return "partial_partition";
    return "degraded";
  }

  startBlackout(nowMs: number, severity: BlackoutSeverity, durationMs: number): void {
    this.state = {
      active: true,
      severity,
      startedAtMs: nowMs,
      endsAtMs: nowMs + durationMs,
    };
  }

  clearBlackout(): void {
    this.state = { active: false, severity: null, startedAtMs: null, endsAtMs: null };
  }

  tick(graph: ConnectivityGraph, nowMs: number, rng: () => number): VertexConnectivityMode {
    if (this.state.active && this.state.endsAtMs != null && nowMs >= this.state.endsAtMs) {
      this.clearBlackout();
      return "recovery";
    }
    if (!this.state.active) return "normal";

    const sev = this.state.severity ?? "degraded";
    for (const e of graph.allEdges()) {
      const stress =
        sev === "full" ? 0.92 + rng() * 0.06 : sev === "partial" ? 0.45 + rng() * 0.2 : 0.15 + rng() * 0.12;
      const quality01 = Math.max(0.02, e.quality01 * (1 - stress));
      const loss = Math.min(0.85, e.loss + stress * 0.5);
      const latencyMs = Math.round(e.latencyMs + stress * 400 + rng() * 180 * stress);
      graph.setEdge({ ...e, quality01, loss, latencyMs });
    }
    return this.vertexModeFromBlackout();
  }

  /** Simulate duplicate delivery / reordering delay for messaging (ms). */
  messageDelayMs(edge: GraphEdge | undefined, rng: () => number): number {
    if (!edge) return 800 + Math.floor(rng() * 1200);
    const base = edge.latencyMs;
    const jitter = rng() * 600 * (0.2 + edge.loss);
    if (rng() < 0.08) return base + jitter + 2000;
    return base + jitter;
  }
}
