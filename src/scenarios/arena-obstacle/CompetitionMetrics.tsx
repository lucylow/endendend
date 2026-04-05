import { motion } from "framer-motion";
import { useArenaObstacleStore } from "@/store/arenaObstacleStore";

export default function CompetitionMetrics() {
  const tashiTime = useArenaObstacleStore((s) => s.tashiTime);
  const aStarTime = useArenaObstacleStore((s) => s.aStarTime);
  const raceComplete = useArenaObstacleStore((s) => s.raceComplete);
  const firstPlaceId = useArenaObstacleStore((s) => s.firstPlaceId);
  const projectedAStar = useArenaObstacleStore((s) => s.projectedAStarSeconds);

  const pct =
    raceComplete && aStarTime > 0 ? Math.min(99, Math.max(0, ((aStarTime - tashiTime) / aStarTime) * 100)) : 0;
  const barPct = raceComplete && aStarTime > 0 ? Math.min(100, (tashiTime / aStarTime) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-950/20 p-6 shadow-xl backdrop-blur-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-xl shadow-lg">🥇</div>
          <h3 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
            Tashi takes gold
          </h3>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="text-3xl font-black tabular-nums text-amber-400">{raceComplete ? tashiTime.toFixed(2) : "—"}s</div>
            <div className="mt-1 text-sm text-zinc-500">Swarm (emergent)</div>
          </div>
          <div>
            <div className="text-3xl font-black tabular-nums text-zinc-500">{raceComplete ? aStarTime.toFixed(2) : projectedAStar.toFixed(2)}s</div>
            <div className="mt-1 text-sm text-zinc-500">Grid A* baseline</div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-5 text-center">
          <div className="text-2xl font-black text-amber-300 tabular-nums">
            {raceComplete ? `${pct.toFixed(0)}% faster` : "Finish a run"}
          </div>
          <p className="mt-1 text-sm text-amber-200/80">Swarm intelligence vs single-planner grid path (demo metric)</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm font-medium text-zinc-400">
          <span>Leader</span>
          <span className="font-mono text-zinc-200">{raceComplete ? firstPlaceId : "Waiting…"}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 shadow-md"
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}

function RaceLeaderboard() {
  const racers = useArenaObstacleStore((s) => s.racers);
  const raceComplete = useArenaObstacleStore((s) => s.raceComplete);
  const sorted = [...racers].sort((a, b) => b.position.x - a.position.x);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h4 className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-500">Positions (X)</h4>
      <ul className="space-y-2 text-sm">
        {sorted.slice(0, 6).map((r, i) => (
          <li key={r.id} className="flex justify-between font-mono text-zinc-300">
            <span className="text-zinc-500">{i + 1}.</span>
            <span>{r.id}</span>
            <span className="text-amber-500/90">{r.position.x.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      {!raceComplete && <p className="mt-2 text-[10px] text-zinc-600">Live ordering by progress toward finish.</p>}
    </div>
  );
}

function PathComparison() {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 text-sm leading-relaxed text-zinc-400">
      <h4 className="mb-2 text-xs font-mono uppercase tracking-widest text-zinc-500">What you are seeing</h4>
      <p>
        Ten agents blend goal seeking, obstacle repulsion, separation, and lane bias — no central path server. The baseline is a
        coarse grid A* length × conservative step time (replan penalty), calibrated so the swarm crosses first for demo recording.
      </p>
    </div>
  );
}

export { RaceLeaderboard, PathComparison };
