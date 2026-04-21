import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRuntimeStore } from "@/lib/state/runtimeStore";
import { Activity, Pause, Play, Radio, Skull, Zap } from "lucide-react";

export function SimulationControls() {
  const enabled = useRuntimeStore((s) => s.mockSimulationEnabled);
  const nodes = useRuntimeStore((s) => s.flatEnvelope.nodes);
  const firstNode = nodes[0]?.nodeId ?? "";

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Activity className="h-4 w-4 shrink-0" aria-hidden />
          Simulation controls
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="mock-sim" className="text-[11px] text-zinc-400">
            Engine
          </Label>
          <Switch id="mock-sim" checked={enabled} onCheckedChange={(v) => useRuntimeStore.getState().setMockSimulationEnabled(v)} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 leading-snug">
        Mock mesh + sensor layer runs alongside the local Vertex engine. Live HTTP snapshots still override mission hints when hybrid
        transport is up.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => useRuntimeStore.getState().toggleMeshPartition()}>
          <Radio className="h-3.5 w-3.5" aria-hidden />
          Partition / recover
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => useRuntimeStore.getState().injectMockTarget()}>
          <Zap className="h-3.5 w-3.5" aria-hidden />
          Target pulse
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          disabled={!firstNode}
          onClick={() => firstNode && useRuntimeStore.getState().injectMockSensorSpike(firstNode)}
        >
          Sensor spike
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => firstNode && useRuntimeStore.getState().forceMockNodeDrop(firstNode)}>
          <Skull className="h-3.5 w-3.5" aria-hidden />
          Drop head node
        </Button>
        <Button type="button" size="sm" variant="secondary" className="h-8 text-xs gap-1" onClick={() => useRuntimeStore.getState().setMockSimulationPaused(true)}>
          <Pause className="h-3.5 w-3.5" aria-hidden />
          Pause stream
        </Button>
        <Button type="button" size="sm" variant="secondary" className="h-8 text-xs gap-1" onClick={() => useRuntimeStore.getState().setMockSimulationPaused(false)}>
          <Play className="h-3.5 w-3.5" aria-hidden />
          Resume
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => useRuntimeStore.getState().replayMockEvents(12)}>
          Replay last 12
        </Button>
      </div>
    </div>
  );
}
