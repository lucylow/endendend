import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useArenaObstacleStore } from "@/store/arenaObstacleStore";
import { RotateCcw, Play, Shuffle } from "lucide-react";

export default function RaceControls() {
  const raceStarted = useArenaObstacleStore((s) => s.raceStarted);
  const raceComplete = useArenaObstacleStore((s) => s.raceComplete);
  const difficulty = useArenaObstacleStore((s) => s.difficulty);
  const setDifficulty = useArenaObstacleStore((s) => s.setDifficulty);
  const startRace = useArenaObstacleStore((s) => s.startRace);
  const reset = useArenaObstacleStore((s) => s.reset);
  const reseed = useArenaObstacleStore((s) => s.reseed);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
      <div className="w-full max-w-[200px] space-y-2">
        <Label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Difficulty</Label>
        <Slider value={[difficulty]} min={0} max={2} step={1} onValueChange={(v) => setDifficulty(v[0] ?? 1)} disabled={raceStarted} />
        <p className="text-[10px] text-zinc-500">More pallets &amp; shelves at higher tiers.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-zinc-600 text-zinc-200"
          onClick={() => reseed()}
          disabled={raceStarted}
        >
          <Shuffle className="mr-1.5 h-3.5 w-3.5" />
          Reseed
        </Button>
        <Button type="button" variant="outline" size="sm" className="border-zinc-600 text-zinc-200" onClick={() => reset()} disabled={raceStarted}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold"
          onClick={() => startRace()}
          disabled={raceStarted}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {raceComplete ? "Race again" : "Start race"}
        </Button>
      </div>
    </div>
  );
}
