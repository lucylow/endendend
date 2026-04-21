import { Link } from "@tanstack/react-router";
import { Pause, Play, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSwarmStore } from "@/stores/swarmStore";
import { cn } from "@/lib/utils";

export default function ScenarioControls() {
  const scenario = useSwarmStore((s) => s.scenario);
  const setScenario = useSwarmStore((s) => s.setScenario);
  const isPlaying = useSwarmStore((s) => s.isPlaying);
  const togglePlay = useSwarmStore((s) => s.togglePlay);
  const setSpeed = useSwarmStore((s) => s.setSpeed);
  const speed = useSwarmStore((s) => s.speed);
  const wsConnected = useSwarmStore((s) => s.wsConnected);

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-[min(100vw-2rem,42rem)] rounded-2xl border border-border bg-gradient-to-r from-zinc-950 to-zinc-900 p-5 text-foreground shadow-2xl">
      <h2 className="mb-3 text-lg font-bold tracking-tight">Track 2 swarm sims</h2>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          variant={scenario === "fallen" ? "default" : "outline"}
          className="h-11"
          asChild
        >
          <Link to="/scenarios/fallen" onClick={() => setScenario("fallen")}>
            Fallen comrade
          </Link>
        </Button>
        <Button
          variant={scenario === "handoff" ? "default" : "outline"}
          className="h-11"
          asChild
        >
          <Link to="/scenarios/handoff" onClick={() => setScenario("handoff")}>
            Blind handoff
          </Link>
        </Button>
        <Button
          variant={scenario === "daisy" ? "default" : "outline"}
          className="h-11"
          asChild
        >
          <Link to="/scenarios/daisy" onClick={() => setScenario("daisy")}>
            Daisy chain
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button variant={isPlaying ? "default" : "outline"} size="sm" onClick={togglePlay} title="Toggles play state + sends sim_control over WS">
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        {([1, 2, 4] as const).map((s) => (
          <Button
            key={s}
            variant={speed === s ? "default" : "outline"}
            size="sm"
            onClick={() => setSpeed(s)}
            className="gap-1"
          >
            <FastForward className="size-3 opacity-70" />
            {s}x
          </Button>
        ))}
        <span
          className={cn(
            "ml-auto text-xs",
            wsConnected ? "text-emerald-500" : "text-muted-foreground",
          )}
        >
          {wsConnected ? "WS OK" : "WS idle"}
        </span>
      </div>
    </div>
  );
}
