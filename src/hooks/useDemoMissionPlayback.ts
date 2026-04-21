import { useCallback, useEffect, useRef, useState } from "react";
import type { SwarmMetricPoint } from "@/hooks/useStreamingMetric";

export type DemoTraceFrame = {
  offsetMs: number;
  peersOnline: number;
  peersStale: number;
  peersIsolated: number;
  consensusP50: number;
  consensusP95: number;
  consensusP99: number;
  rewardTotal: number;
  packetLossByDrone: Record<string, number>;
};

export type DemoTraceFile = { version: number; frames: DemoTraceFrame[] };

function frameToPoint(f: DemoTraceFrame): SwarmMetricPoint {
  return {
    t: Date.now(),
    peersOnline: f.peersOnline,
    peersStale: f.peersStale,
    peersIsolated: f.peersIsolated,
    consensusP50: f.consensusP50,
    consensusP95: f.consensusP95,
    consensusP99: f.consensusP99,
    rewardTotal: f.rewardTotal,
    packetLossByDrone: { ...f.packetLossByDrone },
  };
}

/** Plays ``/blackout-demo-trace.json`` into ``pushPoint`` at ~10 Hz, scaled by ``speed``. */
export function useDemoMissionPlayback(
  pushPoint: (p: SwarmMetricPoint) => void,
  opts: { active: boolean; speed: number; loop?: boolean },
) {
  const [frames, setFrames] = useState<DemoTraceFrame[]>([]);
  const [loadError, setLoadError] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/blackout-demo-trace.json", { cache: "no-store" });
        if (!res.ok) throw new Error("bad");
        const json = (await res.json()) as DemoTraceFile;
        if (!cancelled) setFrames(json.frames ?? []);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!opts.active || !frames.length) return;
    const period = Math.max(40, Math.floor(100 / Math.max(0.25, opts.speed)));
    const id = window.setInterval(() => {
      const i = idxRef.current % frames.length;
      const f = frames[i]!;
      pushPoint(frameToPoint(f));
      idxRef.current++;
      if (!opts.loop && idxRef.current >= frames.length) {
        idxRef.current = 0;
      }
    }, period);
    return () => window.clearInterval(id);
  }, [opts.active, opts.speed, opts.loop, frames, pushPoint]);

  const reset = useCallback(() => {
    idxRef.current = 0;
  }, []);

  return { framesLoaded: frames.length > 0, loadError, reset };
}
