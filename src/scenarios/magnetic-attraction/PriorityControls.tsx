import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useMagneticAttractionStore } from "./magneticAttractionStore";

export default function PriorityControls() {
  const victims = useMagneticAttractionStore((s) => s.victims);
  const setVictimValue = useMagneticAttractionStore((s) => s.setVictimValue);
  const reset = useMagneticAttractionStore((s) => s.reset);
  const simRunning = useMagneticAttractionStore((s) => s.simRunning);
  const setSimRunning = useMagneticAttractionStore((s) => s.setSimRunning);

  return (
    <div className="flex w-full max-w-md flex-col gap-4 lg:max-w-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="mag-run" checked={simRunning} onCheckedChange={setSimRunning} />
          <Label htmlFor="mag-run" className="text-xs text-zinc-400">
            Motion
          </Label>
        </div>
        <Button variant="outline" size="sm" className="gap-1 border-zinc-600 text-xs" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
      <div className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Victim priority (live)</p>
        {victims.map((v) => (
          <div key={v.id} className="flex items-center gap-3">
            <span className="w-8 font-mono text-[10px] text-zinc-500">{v.id}</span>
            <Slider
              value={[v.value]}
              min={0.05}
              max={1}
              step={0.05}
              onValueChange={([n]) => setVictimValue(v.id, n ?? v.value)}
              className="flex-1"
            />
            <span className="w-8 text-right font-mono text-[10px] text-zinc-400">{v.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
