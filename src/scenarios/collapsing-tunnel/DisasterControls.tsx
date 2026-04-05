import { AlertTriangle, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

export default function DisasterControls() {
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);
  const triggerCollapse = useCollapsingTunnelStore((s) => s.triggerCollapse);
  const reset = useCollapsingTunnelStore((s) => s.reset);
  const simRunning = useCollapsingTunnelStore((s) => s.simRunning);
  const setSimRunning = useCollapsingTunnelStore((s) => s.setSimRunning);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Switch id="tunnel-run" checked={simRunning} onCheckedChange={setSimRunning} />
        <Label htmlFor="tunnel-run" className="text-xs text-zinc-400">
          Sim
        </Label>
      </div>
      <Button variant="outline" size="sm" className="gap-2 border-zinc-600" onClick={() => setSimRunning(!simRunning)}>
        {simRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {simRunning ? "Pause" : "Run"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="gap-2 font-bold"
        onClick={triggerCollapse}
        disabled={collapseTriggered}
      >
        <AlertTriangle className="h-4 w-4" />
        Trigger collapse
      </Button>
      <Button variant="secondary" size="sm" className="gap-2" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}
