import type { MissionPhase } from "@/backend/shared/mission-phases";
import type { MissionNodeRole, VertexConnectivityMode } from "@/backend/shared/mission-state";
import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";

export type MobilityClass = "multirotor" | "ground" | "fixed_wing" | "surface";

export type AgentCapabilityProfile = {
  sensors: string[];
  maxPayloadKg: number;
  maxAltitudeM: number;
  maxSpeedMps: number;
  enduranceMin: number;
  meshRangeM: number;
  indoorScore: number;
  outdoorScore: number;
  gpsImuConfidence: number;
  thermalScore: number;
  lidarScore: number;
  lowLightScore: number;
  gripperScore: number;
  computeTier: number;
  batteryDrainPerTick: number;
  recoveryLatencyMs: number;
};

export type SwarmAgentNode = {
  nodeId: string;
  displayName: string;
  vendorId: string;
  model: string;
  role: MissionNodeRole;
  mobility: MobilityClass;
  capabilities: AgentCapabilityProfile;
  position: { x: number; y: number; z: number };
  trust01: number;
  autonomyPolicy: AutonomyPolicyKind;
};

export type AutonomyPolicyKind = "scout_continue" | "relay_maintain" | "rescue_continue" | "map_indoor" | "coordinator_queue";

export type TaskStatus = "open" | "bidding" | "assigned" | "completed" | "expired" | "superseded";

export type SwarmTaskSpec = {
  taskId: string;
  missionId: string;
  taskType: string;
  priority: number;
  location: { x: number; y: number; z: number };
  requirements: string[];
  allowedRoles: MissionNodeRole[];
  preferredVendorTraits: string[];
  minBattery01: number;
  minTrust01: number;
  minConnectivity01: number;
  expiresAtMs: number;
  status: TaskStatus;
  bids: TaskBid[];
  winnerNodeId?: string;
  fallbackNodeIds: string[];
  commitProofHint?: string;
  createdAtMs: number;
};

export type TaskBid = {
  nodeId: string;
  etaSec: number;
  confidence01: number;
  battery01: number;
  link01: number;
  submittedAtMs: number;
  status: "submitted" | "rejected" | "superseded" | "stale";
  score?: number;
  scoreReasons: string[];
};

export type GraphEdge = {
  a: string;
  b: string;
  latencyMs: number;
  loss: number;
  quality01: number;
  viaRelay?: string;
};

export type ConnectivitySnapshot = {
  edges: GraphEdge[];
  partitionClusters: string[][];
  operatorReachable: Set<string>;
  relayChains: string[][];
  bottleneckEdge?: GraphEdge;
  stalePeers: Set<string>;
};

export type BlackoutSeverity = "degraded" | "partial" | "full";

export type SimTelemetrySample = {
  nodeId: string;
  battery01: number;
  cpu01: number;
  mem01: number;
  link01: number;
  queueDepth: number;
  sensorConfidence01: number;
  sequence: number;
  emittedAtMs: number;
  receivedAtMs: number;
  duplicate?: boolean;
};

export type PhaseTransitionProof = {
  fromPhase: MissionPhase;
  toPhase: MissionPhase;
  reason: string;
  quorumMet: boolean;
  tentative: boolean;
};

export type SwarmRuntimeConfig = {
  scenario: MissionScenarioKind;
  seed: number;
  tickMs: number;
  staleHeartbeatMs: number;
  operatorNodeId: string;
};
