import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import type { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import type { FlatMissionEnvelope, MapViewModel, RewardLineViewModel, TaskViewModel } from "@/lib/state/types";
import { normalizeMapGridFromCells } from "@/lib/state/normalizers";

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FallbackScenarioInput = ScenarioKey | MissionScenarioKind;

function scenarioToKind(s: FallbackScenarioInput): MissionScenarioKind {
  const all: MissionScenarioKind[] = [
    "collapsed_building",
    "tunnel",
    "wildfire",
    "extraction",
    "flood_rescue",
    "hazmat",
  ];
  return all.includes(s as MissionScenarioKind) ? (s as MissionScenarioKind) : "collapsed_building";
}

export function createFallbackFlatEnvelope(scenario: FallbackScenarioInput, missionId: string, seed = "demo"): FlatMissionEnvelope {
  const rng = mulberry32(hashSeed(`${seed}|${scenario}|${missionId}`));
  const explored = 40 + Math.floor(rng() * 120);
  const coverage = Math.min(99, Math.round(8 + Math.sqrt(explored) * 4));
  const nodes = Math.floor(4 + rng() * 4);
  const nodeRows: FlatMissionEnvelope["nodes"] = [];
  const roles = ["explorer", "relay", "explorer", "medic", "carrier", "observer"] as const;
  for (let i = 0; i < nodes; i++) {
    const battery = 0.35 + rng() * 0.6;
    nodeRows.push({
      nodeId: `sim-${scenario.slice(0, 3)}-${i + 1}`,
      role: roles[i % roles.length]!,
      trust: Math.round((0.75 + rng() * 0.24) * 1000) / 1000,
      battery: Math.round(battery * 1000) / 1000,
      health: battery < 0.25 ? "degraded" : "online",
      activeTasks: rng() > 0.6 ? 1 : 0,
    });
  }
  const targetCount = 1 + Math.floor(rng() * 3);
  const targets = Array.from({ length: targetCount }, (_, i) => ({
    id: `tgt-${i + 1}`,
    confidence: Math.round((0.55 + rng() * 0.45) * 100) / 100,
    status: i === 0 ? "discovered" : rng() > 0.5 ? "assigned" : "provisional",
  }));

  return {
    missionId,
    scenario: scenarioToKind(scenario),
    phase: rng() > 0.3 ? "search" : "discovery",
    mapSummary: { exploredCells: explored, coveragePercent: coverage, targets },
    nodes: nodeRows,
    alerts:
      rng() > 0.5
        ? [
            {
              type: "battery",
              severity: "warning" as const,
              nodeId: nodeRows[0]?.nodeId ?? "sim",
              message: "Simulated low battery advisory",
            },
          ]
        : [],
    recovery: { state: "recovered", checkpointLag: 0, mapLagPct: 0 },
    settlement: { ready: false, manifestHash: "simulated-pending" },
    source: "mock",
    capturedAtMs: Date.now(),
  };
}

export function createFallbackTasks(scenario: FallbackScenarioInput, seed: string): TaskViewModel[] {
  const rng = mulberry32(hashSeed(`${seed}|tasks|${scenario}`));
  return [
    {
      id: "task-survey",
      type: "perimeter_survey",
      status: "bidding",
      scoreHint: `${Math.round(rng() * 100) / 10}`,
      source: "mock",
    },
    {
      id: "task-triage",
      type: "victim_triage",
      status: "pending",
      source: "mock",
    },
  ];
}

export function createFallbackRewards(seed: string): RewardLineViewModel[] {
  const rng = mulberry32(hashSeed(`${seed}|rewards`));
  return ["drone-a", "drone-b"].map((nodeId, i) => ({
    id: `fr-${i}`,
    nodeId,
    kind: i === 0 ? "discovery" : "relay",
    amount: String(50 + Math.floor(rng() * 80)),
    source: "mock" as const,
  }));
}

export function createFallbackMap(missionId: string, explored: number): MapViewModel {
  return normalizeMapGridFromCells(explored, `fb|${missionId}`, "mock");
}
