import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useObstacleBypassStore } from "./obstacleBypassStore";

export default function BypassControls() {
  const mode = useObstacleBypassStore((s) => s.mode);
  const setMode = useObstacleBypassStore((s) => s.setMode);
  const simRunning = useObstacleBypassStore((s) => s.simRunning);
  const setSimRunning = useObstacleBypassStore((s) => s.setSimRunning);
  const reset = useObstacleBypassStore((s) => s.reset);

  const lf = mode === "leader-follower";

  return (
    <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3 py-2">
        <Label htmlFor="lf-mode" className="text-xs text-zinc-300 cursor-pointer whitespace-nowrap">
          Leader–follower (high collision)
        </Label>
        <Switch id="lf-mode" checked={lf} onCheckedChange={(c) => setMode(c ? "leader-follower" : "swarm")} />
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
