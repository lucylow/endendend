import { Pause, Play, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { usePredatorEvasionStore } from "./predatorEvasionStore";

export default function SecurityControls() {
  const simRunning = usePredatorEvasionStore((s) => s.simRunning);
  const failureTimeScale = usePredatorEvasionStore((s) => s.failureTimeScale);
  const setSimRunning = usePredatorEvasionStore((s) => s.setSimRunning);
  const setFailureTimeScale = usePredatorEvasionStore((s) => s.setFailureTimeScale);
  const reset = usePredatorEvasionStore((s) => s.reset);
  const setMetrics = usePredatorEvasionStore((s) => s.setMetrics);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Button variant="outline" size="sm" className="gap-1.5 border-zinc-600 text-xs" onClick={() => setSimRunning(!simRunning)}>
        {simRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {simRunning ? "Pause" : "Run"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => {
          const t = usePredatorEvasionStore.getState().simTime;
          setMetrics({
            threatActive: true,
            threatT0: t,
            threatArmed: true,
            narrative: "Manual threat — scatter envelope engaged",
          });
        }}
      >
        <Zap className="h-3.5 w-3.5" />
        Force threat
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-zinc-400"
        onClick={() =>
          setMetrics({
            threatActive: false,
            threatT0: null,
            threatArmed: false,
            narrative: "Threat cleared — auto sequence suppressed until reset",
            missionDelaySec: 0,
          })
        }
      >
        Clear threat
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 border-zinc-600 text-xs" onClick={reset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <Label className="text-[10px] uppercase text-zinc-500">Sim speed</Label>
        <Slider
          value={[failureTimeScale]}
          min={0.25}
          max={2.5}
          step={0.05}
          onValueChange={(v) => setFailureTimeScale(v[0] ?? 1)}
        />
      </div>
    </div>
  );
}
