import { useState } from "react";
import { ScenarioWorkspace } from "./ScenarioWorkspace";
import { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { TashiStateEnvelope } from "@/types/tashi";

const MOCK_ENVELOPE: TashiStateEnvelope = {
  missionId: "sar-alpha-2026",
  scenario: "collapsed_building",
  phase: "exploration",
  mapSummary: {
    exploredCells: 142,
    coveragePercent: 64.5,
    targets: [
      { id: "v-1", confidence: 0.92, status: "discovered" },
      { id: "v-2", confidence: 0.88, status: "assigned" },
    ],
  },
  nodes: [
    { nodeId: "drone-01", role: "explorer", trust: 0.98, battery: 0.82, health: "online", activeTasks: 1 },
    { nodeId: "drone-02", role: "relay", trust: 0.95, battery: 0.74, health: "online", activeTasks: 0 },
    { nodeId: "drone-03", role: "explorer", trust: 0.99, battery: 0.45, health: "degraded", activeTasks: 1 },
  ],
  alerts: [
    { type: "battery", severity: "warning", nodeId: "drone-03", message: "Low battery threshold reached" },
  ],
  recovery: {
    state: "recovered",
    checkpointLag: 0,
    mapLagPct: 0,
  },
};

export default function TashiWorkspace() {
  const [scenario, setScenario] = useState<ScenarioKey>("collapsed_building");
  const [envelope] = useState<TashiStateEnvelope>(MOCK_ENVELOPE);

  return (
    <ScenarioWorkspace
      envelope={{ ...envelope, scenario }}
      scenario={scenario}
      onScenarioChange={setScenario}
    />
  );
}
