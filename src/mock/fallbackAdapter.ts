import type { FlatMissionEnvelope, SimulationAugmentation } from "@/lib/state/types";

/** Prefer live fields on the flat envelope; attach simulation under `simulation`. */
export function attachSimulation(
  base: FlatMissionEnvelope,
  sim: SimulationAugmentation,
  preferLive: boolean,
): FlatMissionEnvelope {
  if (preferLive && base.source !== "mock" && base.source !== "fallback") {
    return {
      ...base,
      simulation: { ...sim, source: base.source === "live_http" ? "live_http" : "live" },
    };
  }
  return { ...base, simulation: sim };
}

/** Deep-merge selected mission subfields when live is partial (HTTP hints only). */
export function mergeMissingSubfields(live: FlatMissionEnvelope, mock: FlatMissionEnvelope): FlatMissionEnvelope {
  const nodes =
    live.nodes.length > 0
      ? live.nodes
      : mock.nodes.map((n) => ({ ...n, health: n.health === "online" ? "syncing" : n.health, source: live.source }));

  const targets = live.mapSummary.targets.length > 0 ? live.mapSummary.targets : mock.mapSummary.targets;

  return {
    ...live,
    nodes,
    mapSummary: {
      ...live.mapSummary,
      targets,
      exploredCells: Math.max(live.mapSummary.exploredCells, mock.mapSummary.exploredCells),
      coveragePercent: Math.max(live.mapSummary.coveragePercent, mock.mapSummary.coveragePercent),
    },
    alerts: live.alerts.length > 0 ? live.alerts : mock.alerts,
  };
}
