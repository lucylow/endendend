import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useThermalRebalanceStore } from "./thermalRebalanceStore";

export default function ThermalControls() {
  const simRunning = useThermalRebalanceStore((s) => s.simRunning);
  const reset = useThermalRebalanceStore((s) => s.reset);
  const setSimRunning = useThermalRebalanceStore((s) => s.setSimRunning);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch id="thermal-run" checked={simRunning} onCheckedChange={setSimRunning} />
        <Label htmlFor="thermal-run" className="text-sm text-zinc-400">
          Simulation
        </Label>
      </div>
      <Button variant="outline" size="sm" className="gap-2 border-zinc-600" onClick={() => setSimRunning(!simRunning)}>
        {simRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {simRunning ? "Pause" : "Run"}
      </Button>
      <Button variant="secondary" size="sm" className="gap-2" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}
