import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";

/** Aligned with ``DataSource`` in runtime types; kept local to avoid import cycles. */
export type SimSourceTag = "live" | "live_http" | "local_engine" | "mock" | "restored" | "fallback" | "stale";

export type MissionPhaseSim =
  | "init"
  | "discovery"
  | "search"
  | "triage"
  | "rescue"
  | "extraction"
  | "return"
  | "complete"
  | "aborted";

export type SensorConfidenceLabel =
  | "noise"
  | "weak"
  | "probable"
  | "confirmed"
  | "false_positive"
  | "recovering";

export type SensorReadings = {
  gpsFix: number;
  gpsConfidence: number;
  imuVibration: number;
  imuConfidence: number;
  battery: number;
  thermalC: number;
  thermalConfidence: number;
  opticalConfidence: number;
  irReflectance: number;
  irConfidence: number;
  lidarConfidence: number;
  audioConfidence: number;
  gasPpm: number;
  gasConfidence: number;
  smokeDensity: number;
  moisture: number;
  linkQuality: number;
  cpuLoad: number;
  memUsed: number;
  altitudeM: number;
  speedMps: number;
  geofenceStatus: "inside" | "near_edge" | "breach" | "hazard_zone";
};

export type HealthSnapshot = {
  battery01: number;
  thermalStress: number;
  computeLoad: number;
};

export type ConnectivitySnapshot = {
  linkQuality: number;
  hopCount: number;
  relayId: string | null;
  partition: boolean;
  syncLagMs: number;
};

export type TelemetryPacket = {
  nodeId: string;
  missionId: string;
  timestamp: number;
  scenario: MissionScenarioKind;
  sensors: SensorReadings;
  confidence: SensorConfidenceLabel;
  location: { lat: number; lon: number; accuracyM: number };
  velocity: { x: number; y: number; z: number };
  health: HealthSnapshot;
  connectivity: ConnectivitySnapshot;
  annotations: string[];
  source: SimSourceTag;
};

export type MeshLinkStatus = "up" | "degraded" | "down" | "stale";

export type MeshLinkView = {
  from: string;
  to: string;
  latencyMs: number;
  lossPct: number;
  quality: number;
  status: MeshLinkStatus;
  relay: boolean;
};

export type RouteHop = { nodeId: string; latencyMs: number };

export type MeshRelayChain = {
  primary: string[];
  backup: string[];
  health: number;
};

export type MeshDeliveryStats = {
  attempted: number;
  delivered: number;
  duplicates: number;
  retries: number;
  dropped: number;
};

export type MeshSummaryViewModel = {
  graphEdges: MeshLinkView[];
  relayChain: MeshRelayChain;
  partitionActive: boolean;
  activePeers: string[];
  stalePeers: string[];
  delivery: MeshDeliveryStats;
  meanLatencyMs: number;
  routeQuality: number;
  messageHistoryTail: { id: string; topic: string; delivered: boolean; latencyMs: number; at: number }[];
  subscriptionsSample: { nodeId: string; topics: string[] }[];
  source: SimSourceTag;
};

export type MockNodeRole = "explorer" | "relay" | "medic" | "carrier" | "observer" | "command";

export type MockNodeProfile = {
  nodeId: string;
  role: MockNodeRole;
  capabilities: string[];
  trust01: number;
  reputation01: number;
  relayQuality: number;
  expectedRangeM: number;
  indoorScore: number;
  outdoorScore: number;
  hazardClearance: number;
  failureProb: number;
  recoveryProb: number;
  latencyMeanMs: number;
  latencyJitterMs: number;
  preferredFit: string;
};

export type MockEventKind =
  | "node_join"
  | "node_heartbeat"
  | "sensor_update"
  | "map_delta"
  | "task_open"
  | "task_bid"
  | "task_assign"
  | "target_detected"
  | "target_confirmed"
  | "reward_update"
  | "checkpoint_save"
  | "mission_phase_change"
  | "mesh_partition"
  | "mesh_recovery"
  | "settlement_preview";

export type MockStreamEvent = {
  id: string;
  kind: MockEventKind;
  at: number;
  payload: Record<string, unknown>;
};
