import { useMemo } from "react";
import { ScenarioSwitcher, ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { ScenarioMainPanel } from "@/components/scenario/ScenarioMainPanel";
import { useRuntimeState } from "@/hooks/useRuntimeState";
import { ConnectionStatus } from "@/components/integration/ConnectionStatus";
import { WalletPanel } from "@/components/integration/WalletPanel";
import { MissionPanel } from "@/components/integration/MissionPanel";
import { NodeRegistryPanel } from "@/components/integration/NodeRegistryPanel";
import { MapPanel } from "@/components/integration/MapPanel";
import { TaskBoard } from "@/components/integration/TaskBoard";
import { RewardPanel } from "@/components/integration/RewardPanel";
import { SettlementPreview } from "@/components/integration/SettlementPreview";
import { DebugFeed } from "@/components/integration/DebugFeed";
import { MeshSimulationPanel } from "@/components/integration/MeshSimulationPanel";
import { SensorDashboard } from "@/components/integration/SensorDashboard";
import { SimulationControls } from "@/components/integration/SimulationControls";
import type { FlatMissionEnvelope } from "@/lib/state/types";

const MissionHeader = ({ envelope, title }: { envelope: FlatMissionEnvelope; title: string }) => (
  <header className="border-b border-zinc-800 px-6 py-4 flex flex-col gap-3 bg-zinc-900/50 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-xs text-zinc-500 font-mono uppercase">
        Mission: {envelope.missionId} · Phase: {envelope.phase} · source: {envelope.source}
        {envelope.simulation ? " · mesh/sim: active" : ""}
      </p>
    </div>
    <div className="flex flex-wrap gap-6 md:gap-8">
      <div className="text-right">
        <div className="text-xs text-zinc-500 uppercase">Coverage</div>
        <div className="text-sm font-semibold">{envelope.mapSummary.coveragePercent.toFixed(1)}%</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-zinc-500 uppercase">Nodes</div>
        <div className="text-sm font-semibold">{envelope.nodes.length} roster</div>
      </div>
    </div>
  </header>
);

const SafetyPanel = ({ envelope }: { envelope: FlatMissionEnvelope }) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
    <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-zinc-400">Safety & Alerts</h3>
    <div className="space-y-2">
      {envelope.alerts.length === 0 && <p className="text-xs text-zinc-600">No active alerts.</p>}
      {envelope.alerts.map((alert, i) => (
        <div
          key={i}
          className={`p-2 rounded-lg border ${
            alert.severity === "critical"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          } text-xs`}
        >
          <strong>{alert.type}:</strong> {alert.message}
        </div>
      ))}
    </div>
  </div>
);

const ReplayPanel = ({ envelope }: { envelope: FlatMissionEnvelope }) => {
  const tail = envelope.backend?.ledgerTail;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-zinc-400">Recovery / replay</h3>
      <div className="space-y-2 text-[11px] font-mono text-zinc-400">
        <div>
          state: {envelope.recovery.state} · checkpoint lag {envelope.recovery.checkpointLag} · map lag{" "}
          {envelope.recovery.mapLagPct}%
        </div>
        {tail && <div className="truncate">ledger tail {tail.eventType}</div>}
        {envelope.backend?.recovery?.aggregateHeadline && (
          <div className="text-zinc-500 leading-snug">{envelope.backend.recovery.aggregateHeadline}</div>
        )}
      </div>
    </div>
  );
};

export function ScenarioWorkspace({
  scenario,
  onScenarioChange,
}: {
  scenario: ScenarioKey;
  onScenarioChange: (s: ScenarioKey) => void;
}) {
  const { flatEnvelope, loading } = useRuntimeState();

  const title = useMemo(() => {
    return scenario.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [scenario]);

  const envelopeForPanels = flatEnvelope;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <MissionHeader envelope={flatEnvelope} title={title} />
      <div className="border-b border-zinc-800 px-6 py-3 bg-zinc-900/30 space-y-2">
        <ScenarioSwitcher activeScenario={scenario} onChange={onScenarioChange} />
        <ConnectionStatus />
        {loading && <p className="text-xs text-zinc-500">Syncing runtime…</p>}
      </div>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="xl:col-span-8 space-y-6">
            <SimulationControls />
            <MapPanel />
            <ScenarioMainPanel scenario={scenario} envelope={envelopeForPanels} />
            <MeshSimulationPanel envelope={flatEnvelope} />
            <SensorDashboard envelope={flatEnvelope} />
            <TaskBoard />
          </section>

          <aside className="xl:col-span-4 space-y-6">
            <WalletPanel />
            <MissionPanel />
            <NodeRegistryPanel />
            <RewardPanel />
            <SettlementPreview />
            <SafetyPanel envelope={flatEnvelope} />
            <ReplayPanel envelope={flatEnvelope} />
            <DebugFeed />
          </aside>
        </div>
      </main>
    </div>
  );
}
