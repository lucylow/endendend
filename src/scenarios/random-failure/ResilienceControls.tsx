import { RotateCcw, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useRandomFailureStore } from "./randomFailureStore";

export default function ResilienceControls() {
  const reset = useRandomFailureStore((s) => s.reset);
  const simRunning = useRandomFailureStore((s) => s.simRunning);
  const setSimRunning = useRandomFailureStore((s) => s.setSimRunning);
  const failureTimeScale = useRandomFailureStore((s) => s.failureTimeScale);
  const setFailureTimeScale = useRandomFailureStore((s) => s.setFailureTimeScale);

  return (
    <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label className="text-[10px] uppercase text-zinc-500">Failure clock speed</Label>
        <Slider
          value={[failureTimeScale]}
          min={0.25}
          max={3}
          step={0.25}
          onValueChange={(v) => setFailureTimeScale(v[0] ?? 1)}
          className="py-1"
        />
      </div>
      <div className="flex gap-2">
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
    </div>
  );
}
