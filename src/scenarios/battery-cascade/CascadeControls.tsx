import { Pause, Play, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useBatteryCascadeStore } from "./batteryCascadeStore";

export default function CascadeControls() {
  const accelerateFailure = useBatteryCascadeStore((s) => s.accelerateFailure);
  const setAccelerateFailure = useBatteryCascadeStore((s) => s.setAccelerateFailure);
  const failureTimeScale = useBatteryCascadeStore((s) => s.failureTimeScale);
  const setFailureTimeScale = useBatteryCascadeStore((s) => s.setFailureTimeScale);
  const simRunning = useBatteryCascadeStore((s) => s.simRunning);
  const setSimRunning = useBatteryCascadeStore((s) => s.setSimRunning);
  const reset = useBatteryCascadeStore((s) => s.reset);

  return (
    <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3 py-2">
        <Zap className={`h-4 w-4 ${accelerateFailure ? "text-amber-400" : "text-zinc-500"}`} />
        <Label htmlFor="acc-fail" className="text-xs text-zinc-300 cursor-pointer">
          Accelerate failure
        </Label>
        <Switch id="acc-fail" checked={accelerateFailure} onCheckedChange={setAccelerateFailure} />
      </div>
      <div className="w-40 space-y-1">
        <span className="text-[10px] font-mono text-zinc-500">Time scale</span>
        <Slider
          value={[failureTimeScale]}
          min={0.5}
          max={2.5}
          step={0.1}
          onValueChange={(v) => setFailureTimeScale(v[0] ?? 1)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-zinc-600"
          onClick={() => setSimRunning(!simRunning)}
        >
          {simRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="secondary" className="gap-1" onClick={() => reset()}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
