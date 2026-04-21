import type { DaisyEvent, DaisyEventType } from "./types";

let seq = 0;

export function resetEventIdCounter(seed: number): void {
  seq = seed % 100000;
}

export function emitEvent(
  t: number,
  type: DaisyEventType,
  message: string,
  nodeIds: string[] = [],
  meta?: Record<string, number | string | boolean>,
): DaisyEvent {
  seq += 1;
  return {
    id: `evt_${t.toFixed(3)}_${seq}`,
    t,
    type,
    message,
    nodeIds,
    meta,
  };
}

export function filterEvents(events: DaisyEvent[], types?: Set<DaisyEventType>): DaisyEvent[] {
  if (!types?.size) return events;
  return events.filter((e) => types.has(e.type));
}
