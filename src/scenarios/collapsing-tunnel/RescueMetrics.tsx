import { Clock } from "lucide-react";
import { useMemo } from "react";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

function StatusCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number | string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-xl border bg-zinc-950/60 px-3 py-3 text-center backdrop-blur-sm ${colorClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-zinc-100">{value}</div>
    </div>
  );
}

export default function RescueMetrics() {
  const rescueSpeedup = useCollapsingTunnelStore((s) => s.rescueSpeedup);
  const manualBaselineS = useCollapsingTunnelStore((s) => s.manualBaselineS);
  const tashiRescueS = useCollapsingTunnelStore((s) => s.tashiRescueS);
  const rescueComplete = useCollapsingTunnelStore((s) => s.rescueComplete);
  const agents = useCollapsingTunnelStore((s) => s.agents);
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);

  const counts = useMemo(() => {
    const trapped = agents.filter((a) => a.trapped).length;
    const leads = agents.filter((a) => a.tunnelRescueRole === "rescue_lead" && !a.trapped).length;
    const relay = agents.filter((a) => a.tunnelRescueRole === "relay" && !a.trapped).length;
    const safe = agents.filter((a) => !a.trapped && a.status === "active").length;
    return { trapped, leads, relay, safe };
  }, [agents]);

  const rescueTime = tashiRescueS ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/40 bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl">
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-emerald-400">
          <Clock className="h-6 w-6 shrink-0" />
          Rescue speed (2.1× faster)
        </h3>

        <div className="grid grid-cols-2 gap-8 text-center">
          <div>
            <div className="text-3xl font-black tabular-nums text-emerald-400">
              {rescueComplete || tashiRescueS != null ? `${rescueTime.toFixed(0)}s` : "—"}
            </div>
            <div className="text-sm text-zinc-400">Tashi Swarm</div>
          </div>
          <div>
            <div className="text-3xl font-black tabular-nums text-zinc-400">{manualBaselineS.toFixed(0)}s</div>
            <div className="text-sm text-zinc-400">Manual planning</div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/15 p-4">
          <div className="text-center text-xl font-black text-emerald-400">
            {rescueSpeedup.toFixed(1)}× faster rescue
          </div>
          {rescueComplete ? (
            <p className="mt-2 text-center text-xs text-emerald-300/90">Exit reached — relay chain validated.</p>
          ) : (
            <p className="mt-2 text-center text-xs text-zinc-500">Trigger collapse; survivors sprint to the exit beacon.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/70 p-4 backdrop-blur-xl">
        <StatusCard
          label="Trapped"
          value={collapseTriggered ? counts.trapped : "—"}
          colorClass="border-red-500/35"
        />
        <StatusCard
          label="Rescue leads"
          value={collapseTriggered ? counts.leads : "—"}
          colorClass="border-emerald-500/35"
        />
        <StatusCard
          label="Relay chain"
          value={collapseTriggered ? counts.relay : "—"}
          colorClass="border-sky-500/35"
        />
        <StatusCard label="Safe / active" value={counts.safe} colorClass="border-emerald-500/25" />
      </div>
    </div>
  );
}
