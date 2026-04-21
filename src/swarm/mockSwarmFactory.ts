import { createBaselineSwarmNodeList } from "@/backend/vertex/agent-profiles";
import { defaultRuntimeConfig } from "@/backend/vertex/scenario-presets";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { VertexSwarmSimulator } from "@/backend/vertex/swarm-simulator";
import { MonotonicSharedMap } from "./sharedMap";

export function createMockVertexSimulator(scenario: MissionScenarioKind, seed: number, agentCount = 5): VertexSwarmSimulator {
  const mid = `vertex-mock-${scenario}-${seed}`;
  const cfg = defaultRuntimeConfig(scenario, seed);
  cfg.tickMs = 400;
  return new VertexSwarmSimulator(mid, cfg, Math.max(5, agentCount));
}

export function createSeededBaselineNodes(count = 5, trust01 = 0.9) {
  return createBaselineSwarmNodeList(count, trust01);
}

export function emptyExplorationMap(): MonotonicSharedMap {
  return new MonotonicSharedMap();
}
