import { useObstacleBypassStore } from "./obstacleBypassStore";

export default function CirculationStats() {
  const mode = useObstacleBypassStore((s) => s.mode);
  const cs = useObstacleBypassStore((s) => s.collisionsSwarm);
  const fs = useObstacleBypassStore((s) => s.framesSwarm);
  const cl = useObstacleBypassStore((s) => s.collisionsLeader);
  const fl = useObstacleBypassStore((s) => s.framesLeader);

  const rSwarm = fs ? ((fs - cs) / fs) * 100 : 100;
  const rLf = fl ? ((fl - cl) / fl) * 100 : 100;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-2 text-xs text-zinc-400">
      <p className="font-semibold text-zinc-200 text-sm">Circulation stats</p>
      <div className="grid grid-cols-2 gap-2 font-mono">
        <span>Swarm frames</span>
        <span className="text-right text-zinc-300">{fs}</span>
        <span>Swarm hull hits</span>
        <span className="text-right text-amber-400">{cs}</span>
        <span>Swarm clearance</span>
        <span className="text-right text-emerald-400">{rSwarm.toFixed(1)}%</span>
        <span>LF frames</span>
        <span className="text-right text-zinc-300">{fl}</span>
        <span>LF hull hits</span>
        <span className="text-right text-amber-400">{cl}</span>
        <span>LF clearance</span>
        <span className="text-right text-orange-300">{rLf.toFixed(1)}%</span>
      </div>
      <p className="pt-1 text-[11px] leading-relaxed">
        Active mode: <span className="text-zinc-200">{mode}</span>. Toggle leader–follower to compare emergent CCW flow vs
        greedy goal chase.
      </p>
    </div>
  );
}
