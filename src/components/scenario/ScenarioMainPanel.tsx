import type { ScenarioKey } from "./ScenarioSwitcher";
import type { TashiStateEnvelope } from "@/types/tashi";
import type { VertexSwarmView } from "@/backend/vertex/swarm-simulator";
import { RichScenarioMainPanel } from "./RichScenarioMainPanel";

export function ScenarioMainPanel({
  scenario,
  envelope,
  view,
  onReassignDrone,
}: {
  scenario: ScenarioKey | string;
  envelope: TashiStateEnvelope;
  /** Vertex swarm view — enables relay chains, geofence, and depth charts when running the local simulator. */
  view?: VertexSwarmView | null;
  onReassignDrone?: (nodeId: string) => void;
}) {
  return (
    <RichScenarioMainPanel scenario={scenario} envelope={envelope} view={view ?? null} onReassignDrone={onReassignDrone} />
  );
}
