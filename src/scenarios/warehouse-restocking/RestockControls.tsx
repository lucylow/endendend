import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useWarehouseRestockStore } from "@/store/warehouseRestockStore";

export default function RestockControls() {
  const chaos = useWarehouseRestockStore((s) => s.chaos);
  const running = useWarehouseRestockStore((s) => s.running);
  const setChaos = useWarehouseRestockStore((s) => s.setChaos);
  const setRunning = useWarehouseRestockStore((s) => s.setRunning);
  const reset = useWarehouseRestockStore((s) => s.reset);

  return (
    <div className="flex w-full max-w-md flex-col gap-4 sm:max-w-lg lg:w-auto">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Chaos (shelf motion · stock flux)</Label>
          <span className="font-mono text-xs text-orange-300/90">{chaos.toFixed(0)}</span>
        </div>
        <Slider value={[chaos]} min={0} max={3} step={1} onValueChange={(v) => setChaos(v[0] ?? 0)} className="py-1" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={running ? "secondary" : "default"}
          className="gap-1.5"
          onClick={() => setRunning(!running)}
        >
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {running ? "Pause" : "Run"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5 border-zinc-600" onClick={() => reset()}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset floor
        </Button>
      </div>
    </div>
  );
}
