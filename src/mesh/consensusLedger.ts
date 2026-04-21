import type { MeshConsolidatedEvent } from "./types";

let evSerial = 1;

export class MeshConsensusLedgerView {
  private events: MeshConsolidatedEvent[] = [];

  append(atMs: number, kind: string, summary: string, severity: MeshConsolidatedEvent["severity"], meta?: Record<string, unknown>): void {
    this.events.push({
      id: `mesh-ev-${evSerial++}`,
      atMs,
      kind,
      summary,
      severity,
      meta,
    });
    this.events = this.events.slice(-300);
  }

  tail(n: number): MeshConsolidatedEvent[] {
    return this.events.slice(-n);
  }

  all(): MeshConsolidatedEvent[] {
    return [...this.events];
  }
}
