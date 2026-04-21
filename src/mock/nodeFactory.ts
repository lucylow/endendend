import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { SeededRandom } from "./seededRandom";
import type { MockNodeProfile, MockNodeRole } from "./types";
import { getSensorProfile } from "./sensorProfiles";

const ROLES: MockNodeRole[] = ["explorer", "relay", "medic", "carrier", "observer"];

const CAP_POOLS: Record<MissionScenarioKind, string[][]> = {
  collapsed_building: [
    ["thermal", "lidar", "imu"],
    ["optical", "audio", "imu"],
    ["relay", "lidar"],
    ["relay", "audio"],
    ["triage", "thermal", "audio"],
    ["winch", "optical"],
  ],
  tunnel: [
    ["lidar", "imu", "audio"],
    ["relay", "lidar"],
    ["relay", "audio"],
    ["explorer", "imu"],
    ["optical", "imu"],
  ],
  flood_rescue: [
    ["optical", "moisture"],
    ["relay", "imu"],
    ["carrier", "winch"],
    ["triage", "thermal"],
    ["explorer", "moisture"],
  ],
  wildfire: [
    ["thermal", "ir"],
    ["thermal", "smoke"],
    ["relay", "ir"],
    ["medic", "thermal"],
    ["explorer", "smoke"],
  ],
  hazmat: [
    ["gas", "thermal"],
    ["gas", "optical"],
    ["relay", "gas"],
    ["observer", "gas"],
    ["medic", "thermal"],
  ],
  extraction: [
    ["triage", "audio", "thermal"],
    ["optical", "audio"],
    ["carrier", "winch"],
    ["relay", "optical"],
    ["explorer", "thermal"],
  ],
};

export function buildMockNodeProfiles(
  scenario: MissionScenarioKind,
  seed: string,
  count: number,
  idPrefix = "node",
): MockNodeProfile[] {
  const rng = new SeededRandom(`${seed}|nodes|${scenario}`);
  const prof = getSensorProfile(scenario);
  const caps = CAP_POOLS[scenario] ?? CAP_POOLS.collapsed_building;
  const out: MockNodeProfile[] = [];
  for (let i = 0; i < count; i++) {
    const role = ROLES[i % ROLES.length]!;
    const capRow = caps[i % caps.length]!;
    const trust01 = rng.nextFloat(0.62, 0.98);
    const relayQ =
      role === "relay" ? rng.nextFloat(0.55, 0.98) : rng.nextFloat(0.25, 0.72) * (1 / prof.relayStressMultiplier + 0.35);
    out.push({
      nodeId: `${idPrefix}-${i + 1}`,
      role,
      capabilities: [...new Set(capRow)],
      trust01,
      reputation01: rng.nextFloat(0.5, 0.99),
      relayQuality: relayQ,
      expectedRangeM: rng.nextFloat(40, 220) * (scenario === "tunnel" ? 0.55 : 1),
      indoorScore: scenario === "tunnel" || scenario === "collapsed_building" ? rng.nextFloat(0.65, 0.98) : rng.nextFloat(0.25, 0.75),
      outdoorScore: scenario === "wildfire" || scenario === "flood_rescue" ? rng.nextFloat(0.65, 0.95) : rng.nextFloat(0.35, 0.8),
      hazardClearance: scenario === "hazmat" ? rng.nextFloat(0.7, 0.99) : rng.nextFloat(0.35, 0.85),
      failureProb: rng.nextFloat(0.002, 0.04),
      recoveryProb: rng.nextFloat(0.55, 0.95),
      latencyMeanMs: Math.round(rng.nextFloat(18, 140) * (scenario === "tunnel" ? 1.25 : 1)),
      latencyJitterMs: Math.round(rng.nextFloat(4, 35)),
      preferredFit: prof.label,
    });
  }
  return out;
}
