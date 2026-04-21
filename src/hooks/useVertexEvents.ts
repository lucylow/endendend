import { useEffect, useState } from "react";
import type { VertexSimEvent } from "@/backend/vertex/vertex-event-bus";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";

const MAX = 80;

/** Subscribe to the in-process Vertex event bus for the active simulator. */
export function useVertexEvents() {
  const simulator = useVertexSwarmStore((s) => s.simulator);
  const [events, setEvents] = useState<VertexSimEvent[]>([]);

  useEffect(() => {
    if (!simulator) {
      setEvents([]);
      return;
    }
    const unsub = simulator.bus.subscribe((ev) => {
      setEvents((prev) => [ev, ...prev].slice(0, MAX));
    });
    return unsub;
  }, [simulator]);

  return events;
}
