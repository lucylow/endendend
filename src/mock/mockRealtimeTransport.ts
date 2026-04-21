import type { MockStreamEvent } from "./types";
import type { MockEventStream } from "./eventStream";

/** Periodic fan-out of the latest mock stream event (FoxMQ-style tap for demos). */
export function attachMockRealtimeTap(
  stream: MockEventStream,
  onEvent: (e: MockStreamEvent) => void,
  baseIntervalMs = 1200,
): () => void {
  const t = setInterval(() => {
    if (stream.getControls().paused) return;
    const tail = stream.tail(1)[0];
    if (tail) onEvent(tail);
  }, Math.max(350, baseIntervalMs));
  return () => clearInterval(t);
}
