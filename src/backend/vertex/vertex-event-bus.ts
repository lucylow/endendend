export type VertexSimEvent =
  | { type: "tick"; nowMs: number }
  | { type: "telemetry"; sample: import("./swarm-types").SimTelemetrySample }
  | { type: "connectivity"; mode: import("@/backend/shared/mission-state").VertexConnectivityMode }
  | { type: "task_opened"; taskId: string }
  | { type: "task_assigned"; taskId: string; nodeId: string; reasons: string[] }
  | { type: "ledger_committed"; eventType: string; eventHash: string }
  | { type: "blackout"; active: boolean; severity?: string }
  | { type: "recovery"; message: string }
  | { type: "map_updated"; coverage01: number; frontier: number }
  | { type: "target_candidate"; candidateId: string; confidence01: number }
  | { type: "target_confirmed_bus"; candidateId: string }
  | { type: "role_handoff"; nodeId: string; toRole: string; reason: string };

type Handler = (ev: VertexSimEvent) => void;

export class VertexEventBus {
  private handlers: Handler[] = [];

  subscribe(h: Handler): () => void {
    this.handlers.push(h);
    return () => {
      this.handlers = this.handlers.filter((x) => x !== h);
    };
  }

  emit(ev: VertexSimEvent): void {
    for (const h of this.handlers) {
      try {
        h(ev);
      } catch {
        /* demo bus — ignore subscriber errors */
      }
    }
  }
}
