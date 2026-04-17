import type { RosterEntry } from "@/backend/shared/mission-state";

export type MissionScenarioKind = "collapsed_building" | "tunnel" | "wildfire" | "extraction";

/** Higher is better for role assignment hints (Lattice plane). */
export function scoreNodeForScenario(entry: RosterEntry, kind: MissionScenarioKind): number {
  const caps = new Set(entry.capabilities.map((c) => c.toLowerCase()));
  let score = 50;
  if (kind === "tunnel") {
    if (entry.role === "relay" || caps.has("relay")) score += 40;
    if (caps.has("lidar")) score += 15;
  } else if (kind === "wildfire") {
    if (caps.has("thermal")) score += 45;
    if (entry.role === "explorer") score += 10;
  } else if (kind === "extraction") {
    if (entry.role === "carrier" || caps.has("carrier")) score += 50;
    if (caps.has("winch")) score += 20;
  } else {
    if (entry.role === "explorer") score += 25;
    if (caps.has("thermal") || caps.has("rgb")) score += 15;
  }
  if (caps.has("long_range_radio")) score += 10;
  return score;
}
