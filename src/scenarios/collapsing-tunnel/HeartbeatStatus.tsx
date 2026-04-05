import { HEARTBEAT_TOLERANCE_MS } from "./HeartbeatLossDetection";
import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

export default function HeartbeatStatus() {
  const agents = useCollapsingTunnelStore((s) => s.agents);
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);

  const lost = agents.filter((a) => a.trapped || a.status === "offline").length;
  const active = agents.filter((a) => a.status === "active" && !a.trapped).length;

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 p-4 text-sm">
      <h4 className="mb-2 font-semibold text-zinc-200">Heartbeat / roster</h4>
      <p className="mb-2 text-[10px] text-zinc-500">Mesh heartbeat tolerance {HEARTBEAT_TOLERANCE_MS}ms (mission profile)</p>
      <ul className="space-y-1 text-xs text-zinc-400">
        <li className="flex justify-between">
          <span>Active forward element</span>
          <span className="font-mono text-emerald-400">{active}</span>
        </li>
        <li className="flex justify-between">
          <span>Lost / buried (rear)</span>
          <span className="font-mono text-red-400">{collapseTriggered ? lost : 0}</span>
        </li>
      </ul>
    </div>
  );
}
