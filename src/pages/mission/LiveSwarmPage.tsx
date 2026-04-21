import { useCallback } from "react";
import SwarmVisualizationPage from "@/pages/dashboard/SwarmVisualization";
import { Button } from "@/components/ui/button";
import { useSwarmStore } from "@/store/swarmStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function LiveSwarmPage() {
  const speed = useSwarmStore((s) => s.speed);
  const setSpeed = useSwarmStore((s) => s.setSpeed);
  const isRunning = useSwarmStore((s) => s.isRunning);
  const startSimulation = useSwarmStore((s) => s.startSimulation);
  const pauseSimulation = useSwarmStore((s) => s.pauseSimulation);

  const cycleSpeed = useCallback(() => {
    const order = [0.25, 0.5, 1, 2, 4] as const;
    const nearest = order.reduce((p, c) => (Math.abs(c - speed) < Math.abs(p - speed) ? c : p), order[2]);
    const i = order.indexOf(nearest);
    const next = order[(i + 1) % order.length];
    setSpeed(next);
  }, [setSpeed, speed]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 backdrop-blur-xl",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="font-bold"
          aria-label="Emergency stop"
          onClick={() => toast.error("E-STOP (demo)")}
        >
          E-STOP
        </Button>
        <Button type="button" size="sm" variant="secondary" aria-label="Play simulation" onClick={() => !isRunning && startSimulation()}>
          Play
        </Button>
        <Button type="button" size="sm" variant="secondary" aria-label="Pause simulation" onClick={() => isRunning && pauseSimulation()}>
          Pause
        </Button>
        <Button type="button" size="sm" variant="outline" className="border-white/15" onClick={cycleSpeed} aria-label="Simulation speed">
          Speed {speed}x
        </Button>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-zinc-400">
          <span>
            Alive: <span className="font-mono text-emerald-400">5/5</span>
          </span>
          <span>
            Chain: <span className="font-mono text-cyan-300">4</span>
          </span>
          <span>
            Loss: <span className="font-mono text-amber-300">12%</span>
          </span>
        </div>
      </div>
      <SwarmVisualizationPage layout="mission" />
    </div>
  );
}
