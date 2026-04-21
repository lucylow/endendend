import { useSwarmStore } from "@/stores/swarmStore";

function fmt(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function TelemetryPanel() {
  const rovers = useSwarmStore((s) => s.rovers);
  const victims = useSwarmStore((s) => s.fallenVictims);
  const events = useSwarmStore((s) => s.fallenEvents);
  const meta = useSwarmStore((s) => s.fallenScenarioMeta);

  const discovered = victims.filter((v) => v && typeof v === "object" && (v as { discovered?: boolean }).discovered)
    .length;

  const tail = events.slice(-6);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 max-h-[40vh] overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950/90 p-3 font-mono text-[11px] text-zinc-200 shadow-xl backdrop-blur-sm md:left-auto md:right-4 md:top-24 md:h-auto md:max-h-[min(70vh,520px)] md:w-[min(100vw-2rem,380px)] md:max-w-[380px]">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Telemetry</div>
      {meta ? (
        <div className="mb-2 space-y-0.5 text-[10px] text-zinc-500">
          <div>
            Comm loss T+{fmt(meta.rover_b_comm_loss_start_s as number)}s → dead ≈ T+
            {fmt(meta.expected_rover_b_dead_s as number)}s
          </div>
        </div>
      ) : null}
      <div className="max-h-[22vh] space-y-1 overflow-y-auto pr-1 md:max-h-[220px]">
        {rovers.map((r) => (
          <div key={r.id} className="rounded border border-zinc-800/90 bg-black/40 px-2 py-1.5">
            <div className="flex justify-between gap-2 text-emerald-200/90">
              <span>{r.id}</span>
              <span className="text-zinc-400">{r.state}</span>
            </div>
            <div className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-zinc-400">
              <span>Batt {fmt(r.battery)}%</span>
              <span>HB Δ {fmt(r.telemetry?.heartbeat_age_s)}s</span>
              <span>Cells {r.telemetry?.explored_unique_cells ?? "—"}</span>
              <span>{r.telemetry?.task ?? "—"}</span>
            </div>
            {r.telemetry?.assigned_victims?.length ? (
              <div className="mt-0.5 truncate text-amber-200/80">Victims: {r.telemetry.assigned_victims.join(", ")}</div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
        Victims discovered {discovered}/{victims.length || "—"}
      </div>
      {tail.length > 0 ? (
        <div className="mt-2 max-h-[12vh] overflow-y-auto border-t border-zinc-800 pt-2 text-[10px] text-zinc-500 md:max-h-[120px]">
          {tail.map((ev, i) => {
            const row = ev as { type?: string; sim_time_s?: number };
            return (
              <div key={i} className="truncate">
                {row.type ?? "?"} {row.sim_time_s != null ? `@ ${fmt(row.sim_time_s)}s` : ""}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
