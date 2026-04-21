import type { NetworkConstraintMode } from "./types";
import type { NetworkStressMode } from "@/vertex2/types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";

export type MeshScenarioPreset = {
  id: string;
  label: string;
  description: string;
  loss01: number;
  latencyMs: number;
  jitterMs: number;
  dup01: number;
  reorder01: number;
  discoverySpeed01: number;
  relayBias01: number;
  routeStability01: number;
  recoverySlowdown01: number;
  peerTurnover01: number;
};

export const MESH_SCENARIO_PRESETS: MeshScenarioPreset[] = [
  {
    id: "normal_mesh",
    label: "Normal mesh",
    description: "Baseline RF — predictable discovery and stable routes.",
    loss01: 0.04,
    latencyMs: 45,
    jitterMs: 8,
    dup01: 0.01,
    reorder01: 0.02,
    discoverySpeed01: 0.95,
    relayBias01: 0.35,
    routeStability01: 0.92,
    recoverySlowdown01: 0.05,
    peerTurnover01: 0.02,
  },
  {
    id: "degraded_mesh",
    label: "Degraded mesh",
    description: "Elevated retries, slower neighbor exchange.",
    loss01: 0.14,
    latencyMs: 95,
    jitterMs: 22,
    dup01: 0.04,
    reorder01: 0.08,
    discoverySpeed01: 0.72,
    relayBias01: 0.55,
    routeStability01: 0.68,
    recoverySlowdown01: 0.22,
    peerTurnover01: 0.06,
  },
  {
    id: "high_latency_mesh",
    label: "High-latency mesh",
    description: "GEO / sat-style delays, delayed ACKs.",
    loss01: 0.08,
    latencyMs: 420,
    jitterMs: 120,
    dup01: 0.06,
    reorder01: 0.12,
    discoverySpeed01: 0.5,
    relayBias01: 0.62,
    routeStability01: 0.55,
    recoverySlowdown01: 0.45,
    peerTurnover01: 0.04,
  },
  {
    id: "lossy_mesh",
    label: "Lossy mesh",
    description: "Heavy packet loss — relays and buffering dominate.",
    loss01: 0.38,
    latencyMs: 70,
    jitterMs: 18,
    dup01: 0.12,
    reorder01: 0.1,
    discoverySpeed01: 0.42,
    relayBias01: 0.88,
    routeStability01: 0.4,
    recoverySlowdown01: 0.35,
    peerTurnover01: 0.12,
  },
  {
    id: "partitioned_mesh",
    label: "Partitioned mesh",
    description: "Split clusters — local autonomy and merge stress.",
    loss01: 0.12,
    latencyMs: 80,
    jitterMs: 20,
    dup01: 0.05,
    reorder01: 0.07,
    discoverySpeed01: 0.55,
    relayBias01: 0.75,
    routeStability01: 0.35,
    recoverySlowdown01: 0.55,
    peerTurnover01: 0.08,
  },
  {
    id: "tunnel_connectivity",
    label: "Tunnel-like connectivity",
    description: "Narrow bridges — bottlenecks and chain relays.",
    loss01: 0.18,
    latencyMs: 55,
    jitterMs: 12,
    dup01: 0.03,
    reorder01: 0.05,
    discoverySpeed01: 0.62,
    relayBias01: 0.92,
    routeStability01: 0.48,
    recoverySlowdown01: 0.28,
    peerTurnover01: 0.05,
  },
  {
    id: "urban_obstruction",
    label: "Urban obstruction",
    description: "Multipath + shadowing — unstable routes.",
    loss01: 0.22,
    latencyMs: 110,
    jitterMs: 40,
    dup01: 0.08,
    reorder01: 0.14,
    discoverySpeed01: 0.58,
    relayBias01: 0.7,
    routeStability01: 0.42,
    recoverySlowdown01: 0.32,
    peerTurnover01: 0.09,
  },
  {
    id: "wildfire_interference",
    label: "Wildfire interference",
    description: "Thermal / smoke RF absorption spikes.",
    loss01: 0.28,
    latencyMs: 130,
    jitterMs: 55,
    dup01: 0.07,
    reorder01: 0.11,
    discoverySpeed01: 0.48,
    relayBias01: 0.8,
    routeStability01: 0.38,
    recoverySlowdown01: 0.4,
    peerTurnover01: 0.1,
  },
  {
    id: "cave_interference",
    label: "Cave interference",
    description: "Non-line-of-sight, heavy buffering.",
    loss01: 0.32,
    latencyMs: 160,
    jitterMs: 45,
    dup01: 0.05,
    reorder01: 0.09,
    discoverySpeed01: 0.4,
    relayBias01: 0.85,
    routeStability01: 0.36,
    recoverySlowdown01: 0.48,
    peerTurnover01: 0.07,
  },
  {
    id: "disaster_zone_blackout",
    label: "Disaster-zone blackout",
    description: "Intermittent islands — aggressive autonomy.",
    loss01: 0.35,
    latencyMs: 200,
    jitterMs: 80,
    dup01: 0.1,
    reorder01: 0.15,
    discoverySpeed01: 0.35,
    relayBias01: 0.9,
    routeStability01: 0.3,
    recoverySlowdown01: 0.62,
    peerTurnover01: 0.14,
  },
];

export function presetById(id: string): MeshScenarioPreset {
  return MESH_SCENARIO_PRESETS.find((p) => p.id === id) ?? MESH_SCENARIO_PRESETS[0]!;
}

export function constraintModeFromSignals(
  vertexMode: VertexConnectivityMode,
  stress: NetworkStressMode,
): NetworkConstraintMode {
  if (vertexMode === "blackout" || stress === "offline") return "isolated";
  if (vertexMode === "partial_partition" || stress === "partitioned") return "partitioned";
  if (vertexMode === "recovery" || stress === "recovery") return "recovering";
  if (vertexMode === "resync") return "reconnected";
  if (stress === "lossy") return "unstable";
  if (stress === "high_latency" || stress === "degraded") return "degraded";
  if (vertexMode === "degraded") return "degraded";
  return "normal";
}
