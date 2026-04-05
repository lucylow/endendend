import { RotateCcw, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { usePredatorEvasionStore } from "./predatorEvasionStore";

export default function EvasionControls() {
  const reset = usePredatorEvasionStore((s) => s.reset);
  const simRunning = usePredatorEvasionStore((s) => s.simRunning);
  const setSimRunning = usePredatorEvasionStore((s) => s.setSimRunning);
  const failureTimeScale = usePredatorEvasionStore((s) => s.failureTimeScale);
  const setFailureTimeScale = usePredatorEvasionStore((s) => s.setFailureTimeScale);
  const narrative = usePredatorEvasionStore((s) => s.narrative);

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label className="text-[10px] uppercase text-zinc-500">Demo clock speed</Label>
        <Slider
          value={[failureTimeScale]}
          min={0.25}
          max={2}
          step={0.25}
          onValueChange={(v) => setFailureTimeScale(v[0] ?? 1)}
          className="py-1"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={simRunning ? "secondary" : "default"}
          size="sm"
          className="gap-1.5"
          onClick={() => setSimRunning(!simRunning)}
        >
          {simRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {simRunning ? "Pause" : "Run"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 border-zinc-600" onClick={() => reset()}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
      <p className="hidden text-[11px] text-zinc-500 lg:block max-w-[200px] truncate" title={narrative}>
        {narrative}
      </p>
    </div>
  );
}
