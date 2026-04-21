import { SeededRandom } from "./seededRandom";
import type { TaskViewModel } from "@/lib/state/types";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";

const TYPES: Record<MissionScenarioKind, string[]> = {
  collapsed_building: ["debris_scan", "relay_extension", "victim_triage"],
  tunnel: ["lidar_slam_segment", "audio_ping_map", "relay_chain_health"],
  flood_rescue: ["swiftwater_recon", "victim_track", "shore_supply"],
  wildfire: ["thermal_corridor", "smoke_penetration", "evac_anchor"],
  hazmat: ["gas_grid_sample", "geofence_patrol", "decon_staging"],
  extraction: ["vitals_cluster", "hoist_ready", "route_clearance"],
};

export function mockOpenTasks(scenario: MissionScenarioKind, seed: string, count = 3): TaskViewModel[] {
  const rng = new SeededRandom(`${seed}|tasks`);
  const pool = TYPES[scenario] ?? TYPES.collapsed_building;
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${scenario.slice(0, 3)}-${i + 1}`,
    type: pool[i % pool.length]!,
    status: i === 0 ? "bidding" : i === 1 ? "pending" : "assigned",
    scoreHint: `${Math.round(rng.nextFloat(4, 9.8) * 10) / 10}`,
    assignee: i === 2 ? `node-${(i % 3) + 1}` : undefined,
    source: "mock",
  }));
}
