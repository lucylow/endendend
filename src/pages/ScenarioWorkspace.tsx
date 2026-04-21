import { useMemo } from "react";
import { ScenarioSwitcher, ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { ScenarioMainPanel } from "@/components/scenario/ScenarioMainPanel";
import type { TashiStateEnvelope } from "@/types/tashi";

// Mock components for the shell
const MissionHeader = ({ envelope, title }: { envelope: TashiStateEnvelope; title: string }) => (
  <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-900/50">
    <div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-xs text-zinc-500 font-mono uppercase">Mission: {envelope.missionId} • Phase: {envelope.phase}</p>
    </div>
    <div className="flex gap-4">
      <div className="text-right">
        <div className="text-xs text-zinc-500 uppercase">Coverage</div>
        <div className="text-sm font-semibold">{envelope.mapSummary.coveragePercent}%</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-zinc-500 uppercase">Nodes</div>
        <div className="text-sm font-semibold">{envelope.nodes.length} Active</div>
      </div>
    </div>
  </header>
);

const MapPanel = ({ envelope }: { envelope: TashiStateEnvelope }) => (
  <div className="aspect-video rounded-2xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-center overflow-hidden relative">
    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
    <div className="text-zinc-500 text-sm font-mono">MAP_VIEWPORT: {envelope.mapSummary.exploredCells} CELLS EXPLORED</div>
  </div>
);

const NodeFleetPanel = ({ envelope }: { envelope: TashiStateEnvelope }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
    <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-zinc-400">Fleet Status</h3>
    <div className="space-y-2">
      {envelope.nodes.map(node => (
        <div key={node.nodeId} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${node.health === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
            <span className="text-xs font-mono">{node.nodeId}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">{node.role}</span>
        </div>
      ))}
    </div>
  </div>
);

const SafetyPanel = ({ envelope }: { envelope: TashiStateEnvelope }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
    <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-zinc-400">Safety & Alerts</h3>
    <div className="space-y-2">
      {envelope.alerts.map((alert, i) => (
        <div key={i} className={`p-2 rounded-lg border ${alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'} text-xs`}>
          <strong>{alert.type}:</strong> {alert.message}
        </div>
      ))}
    </div>
  </div>
);

const ReplayPanel = ({ missionId }: { missionId: string }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
    <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-zinc-400">Mission Replay</h3>
    <div className="h-24 flex items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-600 text-xs">
      REPLAY_CONTROLS_ID: {missionId}
    </div>
  </div>
);

export function ScenarioWorkspace({
  envelope,
  scenario,
  onScenarioChange,
}: {
  envelope: TashiStateEnvelope;
  scenario: ScenarioKey;
  onScenarioChange: (s: ScenarioKey) => void;
}) {
  const title = useMemo(() => {
    return scenario.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [scenario]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <MissionHeader envelope={envelope} title={title} />
      <div className="border-b border-zinc-800 px-6 py-3 bg-zinc-900/30">
        <ScenarioSwitcher activeScenario={scenario} onChange={onScenarioChange} />
      </div>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="xl:col-span-8 space-y-6">
            <MapPanel envelope={envelope} />
            <ScenarioMainPanel scenario={scenario} envelope={envelope} />
          </section>

          <aside className="xl:col-span-4 space-y-6">
            <NodeFleetPanel envelope={envelope} />
            <SafetyPanel envelope={envelope} />
            <ReplayPanel missionId={envelope.missionId} />
          </aside>
        </div>
      </main>
    </div>
  );
}
