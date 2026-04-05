import { useCollapsingTunnelStore } from "./collapsingTunnelStore";

const STEPS = [
  { t: "0:00", label: "Normal tunnel exploration" },
  { t: "0:18", label: "Tunnel collapse — 3 trapped behind debris" },
  { t: "0:25", label: "Heartbeat loss → instant awareness" },
  { t: "0:38", label: "New relay chain forms" },
  { t: "0:55", label: "Rescue path complete (2.1× faster)" },
  { t: "1:10", label: "Rescue success" },
];

export default function ChainReformationTimeline() {
  const collapseTriggered = useCollapsingTunnelStore((s) => s.collapseTriggered);
  const beaconSent = useCollapsingTunnelStore((s) => s.beaconSent);
  const rescueComplete = useCollapsingTunnelStore((s) => s.rescueComplete);

  const phase = !collapseTriggered ? 0 : !beaconSent ? 2 : !rescueComplete ? 4 : 5;

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4">
      <h4 className="mb-3 text-sm font-semibold text-zinc-200">Demo beats</h4>
      <ol className="space-y-2 text-xs">
        {STEPS.map((s, i) => (
          <li
            key={s.t}
            className={`flex gap-2 border-l-2 pl-2 ${
              i <= phase ? "border-emerald-500 text-zinc-200" : "border-zinc-700 text-zinc-500"
            }`}
          >
            <span className="w-10 shrink-0 font-mono text-zinc-500">{s.t}</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
