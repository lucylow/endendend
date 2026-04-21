import { useEffect, useRef } from "react";
import { useSwarmStore } from "@/stores/swarmStore";
import { FallenComradeMockEngine } from "./mockEngine";

function mockFrameErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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
        const engine = engineRef.current;
        if (!engine) {
          raf = requestAnimationFrame(tick);
          return;
        }
        try {
          const f = engine.step(dt);
          ingestMockFrame({
            time: f.time,
            global_map: f.global_map,
            reallocated: f.reallocated,
            rovers: f.rovers,
            victims: f.victims,
            obstacles: f.obstacles,
            events: f.events,
            scenario_meta: f.scenario_meta,
          });
        } catch (e) {
          useSwarmStore.setState({
            lastError: `Fallen comrade mock tick failed: ${mockFrameErrorMessage(e)}`,
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wsConnected, isPlaying, speed, ingestMockFrame]);
}
