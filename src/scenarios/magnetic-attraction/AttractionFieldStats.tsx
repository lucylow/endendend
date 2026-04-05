import { useMagneticAttractionStore } from "./magneticAttractionStore";

export default function AttractionFieldStats() {
  const agents = useMagneticAttractionStore((s) => s.agents);
  const attractionActive = useMagneticAttractionStore((s) => s.attractionActive);
  const totalStake = agents.reduce((s, a) => s + a.stakeAmount, 0);

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/20 p-4 text-sm">
      <h4 className="mb-2 font-semibold text-indigo-300">Field stats</h4>
      <dl className="space-y-1 text-xs text-zinc-400">
        <div className="flex justify-between">
          <dt>Active agents</dt>
          <dd className="font-mono text-zinc-200">{agents.filter((a) => a.status === "active").length}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Σ stake (mesh weights)</dt>
          <dd className="font-mono text-zinc-200">{Math.round(totalStake)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Attraction field</dt>
          <dd className="text-emerald-400/90">{attractionActive ? "ON" : "OFF"}</dd>
        </div>
      </dl>
    </div>
  );
}
