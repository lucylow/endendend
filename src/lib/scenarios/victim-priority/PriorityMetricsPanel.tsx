import { Badge } from "@/components/ui/badge";
import { useScenarioVizStore, type VictimRescueRole } from "@/store/scenarioVizStore";

function RoleCount({ label, role, color }: { label: string; role: VictimRescueRole; color: string }) {
  const victimAgents = useScenarioVizStore((s) => s.victimAgents);
  const count = victimAgents.filter((a) => a.victimDetected && a.rescueRole === role).length;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2 py-3">
      <div className="text-2xl font-black tabular-nums" style={{ color }}>
        {count}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function PriorityMetricsPanel() {
  const scenarioStats = useScenarioVizStore((s) => s.scenarioStats);
  const missionComplete = useScenarioVizStore((s) => s.missionComplete);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/30 bg-card/40 p-5 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="font-bold text-lg">Tashi vs static</h3>
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shrink-0">
            {scenarioStats.speedup}s faster
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">
              {scenarioStats.tashiSeconds}s
            </div>
            <div className="text-xs text-muted-foreground mt-1">Tashi swarm</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-zinc-400 tabular-nums">
              {scenarioStats.staticSeconds}s
            </div>
            <div className="text-xs text-muted-foreground mt-1">Static reassign</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">50%</div>
            <div className="text-xs text-muted-foreground mt-1">Faster</div>
          </div>
        </div>
        {missionComplete ? (
          <p className="mt-3 text-xs text-emerald-400/90 font-medium text-center">Victim reached — roles held through stake voting</p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
        <RoleCount label="Converge" role="converge" color="#10b981" />
        <RoleCount label="Relay" role="relay" color="#3b82f6" />
        <RoleCount label="Search" role="search" color="#f59e0b" />
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed px-0.5">
        Rover C flips the victim flag near sector C3; A+B-sized priority mass shifts to converge while the tail keeps search
        lanes — watch the 3D badges once the cue fires.
      </p>
    </div>
  );
}
