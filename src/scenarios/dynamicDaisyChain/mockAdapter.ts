import type { EngineSnapshot } from "./types";
import type { ScenarioVariantId } from "./types";
import { DynamicDaisyScenarioEngine } from "./scenarioEngine";
import { simNodeId } from "./scenarioEngine";

/** Shape consumed by Track2 `useSwarmStore.ingestMockFrame`. */
export interface Track2MockFrame {
  time: number;
  tunnel_depth: number;
  relay_chain: string[];
  signal_quality: Record<string, number>;
  global_map: number[][];
  rovers: {
    id: string;
    position: [number, number, number];
    battery: number;
    state: "exploring" | "dead" | "reallocating";
    sector: { bounds: [number, number, number, number] };
  }[];
}

function snapshotToGlobalMap(snap: EngineSnapshot): number[][] {
  const cells = snap.map.cells;
  if (!cells.length) return [];
  const rows = 1;
  const cols = cells.length;
  const row: number[] = new Array(cols).fill(0);
  for (let i = 0; i < cols; i++) {
    const c = cells[i];
    if (!c) continue;
    if (c.kind === "explored") row[i] = 2;
    else if (c.kind === "relay_anchor") row[i] = 3;
    else if (c.kind === "target") row[i] = 4;
    else if (c.kind === "blocked") row[i] = 1;
    else if (c.kind === "frontier") row[i] = 5;
    else if (c.kind === "stale") row[i] = 6;
  }
  return [row];
}

export function engineSnapshotToTrack2Mock(snap: EngineSnapshot): Track2MockFrame {
  const lead = snap.nodes.find((n) => n.role === "lead_explorer") ?? snap.nodes[0];
  const depth = lead?.s ?? 0;
  const chain = ["entrance", ...snap.relayPlan.orderedRelayIds, lead ? simNodeId(lead) : "lead"];

  const signal_quality: Record<string, number> = {};
  for (const n of snap.nodes) {
    const tel = snap.telemetry.find((t) => t.nodeId === simNodeId(n));
    signal_quality[simNodeId(n)] = tel?.linkIngress ?? 0.5 * (n.battery / 100);
  }
  for (const h of snap.signalHops) {
    signal_quality[`${h.fromId}→${h.toId}`] = Math.max(0.04, 1 - h.loss);
  }

  const rovers = snap.nodes.map((n) => {
    const st: "exploring" | "dead" | "reallocating" =
      n.connectivity === "offline" ? "dead" : n.role === "lead_explorer" ? "exploring" : "exploring";
    return {
      id: simNodeId(n),
      position: [n.s, n.lateral, n.isRelay ? 1.2 : 0.6] as [number, number, number],
      battery: n.battery,
      state: st,
      sector: { bounds: [-1, 1, -1, 1] as [number, number, number, number] },
    };
  });

  return {
    time: snap.t,
    tunnel_depth: depth,
    relay_chain: chain,
    signal_quality,
    global_map: snapshotToGlobalMap(snap),
    rovers,
  };
}

export function createMockAdapter(seed: number, variant: ScenarioVariantId["id"] = "default") {
  const engine = new DynamicDaisyScenarioEngine(seed, variant);
  return {
    engine,
    step(dt: number): { snapshot: EngineSnapshot; track2: Track2MockFrame } {
      const snapshot = engine.step(dt);
      return { snapshot, track2: engineSnapshotToTrack2Mock(snapshot) };
    },
    reset(nextSeed: number, nextVariant: ScenarioVariantId["id"] = "default") {
      engine.reset(nextSeed, nextVariant);
    },
  };
}
