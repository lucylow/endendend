import { Link2 } from "lucide-react";
import { useScenarioVizStore } from "@/store/scenarioVizStore";

function SwarmStatusPill({ label, active, tone }: { label: string; active: boolean; tone: "emerald" | "blue" }) {
  const ring = tone === "emerald" ? "border-emerald-500/40 text-emerald-300" : "border-blue-500/40 text-blue-300";
  const bg = active ? (tone === "emerald" ? "bg-emerald-500/15" : "bg-blue-500/15") : "bg-muted/20";
  return (
    <div className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold ${ring} ${bg}`}>
      {label}
      <div className="text-[10px] font-normal text-muted-foreground mt-0.5">{active ? "Active" : "Standby"}</div>
    </div>
  );
}

export default function HandoffMetrics() {
  const handoffTimeMs = useScenarioVizStore((s) => s.handoffTimeMs);
  const consensusLatencyMs = useScenarioVizStore((s) => s.consensusLatencyMs);
  const zeroDowntime = useScenarioVizStore((s) => s.zeroDowntime);
  const handoffActive = useScenarioVizStore((s) => s.handoffActive);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/35 bg-card/40 p-5 backdrop-blur-xl shadow-lg">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-emerald-400">
          <Link2 className="h-5 w-5 shrink-0 opacity-90" />
          Handoff performance
        </h3>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-black text-emerald-400 tabular-nums">
              {handoffActive ? `${handoffTimeMs.toFixed(0)}ms` : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Total handoff</div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 tabular-nums">
              {handoffActive ? `${consensusLatencyMs.toFixed(0)}ms` : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Consensus latency</div>
          </div>
        </div>

        {zeroDowntime && handoffActive ? (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
            <div className="text-sm font-bold text-emerald-400">Zero downtime</div>
            <div className="text-[11px] text-emerald-200/75">Independent swarms — FoxMQ-style transfer</div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SwarmStatusPill label="Swarm A" active={!handoffActive} tone="emerald" />
        <SwarmStatusPill label="Swarm B" active={handoffActive} tone="blue" />
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Swarm A closes to the pallet; a single broadcast carries coordinates and stakes; Swarm B adopts the approach vector
        and forms the lift ring — judge-visible dual-fleet story.
      </p>
    </div>
  );
}
