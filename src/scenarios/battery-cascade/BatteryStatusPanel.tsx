import { useBatteryCascadeStore } from "./batteryCascadeStore";
import { getBatteryColor } from "./BatteryVisualizer3D";

export default function BatteryStatusPanel() {
  const agents = useBatteryCascadeStore((s) => s.agents);
  const cascade = useBatteryCascadeStore((s) => s.scenarioStats.cascadeTriggered);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Live battery</h3>
        {cascade ? (
          <span className="text-[10px] font-mono uppercase tracking-wider text-red-400">Cascade latched</span>
        ) : null}
      </div>
      <ul className="space-y-2">
        {agents.map((a) => (
          <li key={a.id} className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-zinc-200 truncate">
                {a.name}{" "}
                <span className="text-zinc-500 font-normal">({a.role})</span>
              </span>
              <span className="font-mono tabular-nums" style={{ color: getBatteryColor(a.battery) }}>
                {a.battery.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, a.battery)}%`,
                  backgroundColor: getBatteryColor(a.battery),
                }}
              />
            </div>
            <div className="mt-1 text-[10px] text-zinc-500 capitalize">{a.status}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
