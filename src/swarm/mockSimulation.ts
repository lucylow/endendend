import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { VertexSwarmSimulator } from "@/backend/vertex/swarm-simulator";
import { defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";

export type MockSwarmRuntimeOptions = {
  missionId?: string;
  scenario: MissionScenarioKind;
  seed: number;
  agentCount: number;
  tickMs?: number;
};

/**
 * Browser-local mock swarm runtime (no cloud transport). Same engine as Vertex demos, packaged for P2P UI wiring.
 */
export function createSwarmMockRuntime(opts: MockSwarmRuntimeOptions): VertexSwarmSimulator {
  const mid = opts.missionId ?? `p2p-mock-${opts.scenario}-${opts.seed}`;
  const cfg = defaultRuntimeConfig(opts.scenario, opts.seed);
  if (opts.tickMs != null) cfg.tickMs = opts.tickMs;
  return new VertexSwarmSimulator(mid, cfg, Math.max(5, opts.agentCount));
}
