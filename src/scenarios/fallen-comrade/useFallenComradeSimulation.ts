import { useEffect, useRef } from "react";
import { useSwarmStore } from "@/stores/swarmStore";
import { FallenComradeMockEngine } from "./mockEngine";

/**
 * When the Track 2 WebSocket is offline, drive `useSwarmStore` from the in-browser
 * FallenComradeMockEngine at display rate (respects play/pause and speed).
 */
export function useFallenComradeSimulation() {
  const wsConnected = useSwarmStore((s) => s.wsConnected);
  const ingestMockFrame = useSwarmStore((s) => s.ingestMockFrame);
  const isPlaying = useSwarmStore((s) => s.isPlaying);
  const speed = useSwarmStore((s) => s.speed);
  const engineRef = useRef<FallenComradeMockEngine | null>(null);
  if (!engineRef.current) engineRef.current = new FallenComradeMockEngine(42);

  useEffect(() => {
    if (wsConnected) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const raw = (now - last) / 1000;
      last = now;
      const dt = Math.min(0.05, raw) * speed;
      if (isPlaying) {
        const f = engineRef.current!.step(dt);
        ingestMockFrame({
          time: f.time,
          global_map: f.global_map,
          reallocated: f.reallocated,
          rovers: f.rovers,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wsConnected, isPlaying, speed, ingestMockFrame]);
}
