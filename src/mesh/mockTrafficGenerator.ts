import { mulberry32 } from "@/swarm/seededRng";
import type { MeshScenarioPreset } from "./networkConstraints";

export type TrafficPulse = {
  atTick: number;
  kind: "heartbeat" | "discovery" | "state_delta" | "relay_ping";
  volume: number;
};

export function generateTrafficSchedule(seed: number, ticks: number, preset: MeshScenarioPreset): TrafficPulse[] {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const pulses: TrafficPulse[] = [];
  const base = 3 + Math.floor(preset.peerTurnover01 * 8);
  for (let t = 0; t < ticks; t += base) {
    const roll = rng();
    const kind: TrafficPulse["kind"] =
      roll < 0.35 ? "heartbeat" : roll < 0.62 ? "discovery" : roll < 0.85 ? "state_delta" : "relay_ping";
    pulses.push({ atTick: t, kind, volume: 0.4 + rng() * preset.routeStability01 });
  }
  return pulses;
}
