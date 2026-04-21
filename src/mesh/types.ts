import type { ConnectivitySnapshot, GraphEdge, SimTelemetrySample, SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";
import type { MeshResiliencePublicView, NetworkStressMode } from "@/vertex2/types";

/** Per-observer discovery lifecycle for a remote peer (no central registry authority). */
export type DiscoveryPeerState =
  | "unknown"
  | "suspected"
  | "discovered"
  | "confirmed"
  | "stale"
  | "lost"
  | "recovered";

export type MeshNodeArchetype =
  | "scout_drone"
  | "relay_drone"
  | "indoor_robot"
  | "rescue_robot"
  | "backup_coordinator"
  | "sensor_node"
  | "transport_node"
  | "standby_node";

export type NetworkConstraintMode =
  | "normal"
  | "degraded"
  | "unstable"
  | "partitioned"
  | "isolated"
  | "recovering"
  | "reconnected";

export type MeshPeerRichProfile = {
  nodeId: string;
  displayName: string;
  vendorOrFamily: string;
  roleLabel: string;
  archetype: MeshNodeArchetype;
  communicationRangeM: number;
  antennaGain01: number;
  battery01: number;
  trust01: number;
  reliability01: number;
  packetLossSensitivity01: number;
  latencySensitivity01: number;
  relaySuitability01: number;
  autonomyLevel01: number;
  sensorStack: string[];
  position: { x: number; y: number; z: number };
  connectivityState: "linked" | "degraded" | "isolated" | "offline";
  lastHeartbeatMs: number;
  partitionClusterId: string;
  localQueueDepth: number;
  recoveryReadiness01: number;
};

export type MeshOperationalEdge = GraphEdge & {
  routeCost: number;
  relayImportance01: number;
  indirectHint?: string;
};

export type MeshOperationalGraph = {
  nodes: string[];
  edges: MeshOperationalEdge[];
  partitionClusters: string[][];
  bridgeNodes: string[];
  bottleneckEdge?: MeshOperationalEdge;
  isolatedNodes: string[];
  operatorReachable: string[];
  recoveryEdges: MeshOperationalEdge[];
};

export type RelayNomination = {
  nodeId: string;
  score01: number;
  reasons: string[];
  holdsPosition: boolean;
  estimatedLoad01: number;
};

export type RoutePlan = {
  topic: string;
  fromId: string;
  toId: string;
  primaryPath: string[];
  backupPath: string[];
  primaryQuality01: number;
  backupQuality01: number;
};

export type MeshEnvelopeDeliveryStatus = "pending" | "delivered" | "dropped" | "buffered" | "duplicate";

export type MeshMessageEnvelope = {
  messageId: string;
  sender: string;
  receiver: string | "broadcast";
  topic: string;
  timestamp: number;
  missionId: string;
  sequence: number;
  retryCount: number;
  pathTaken: string[];
  deliveryStatus: MeshEnvelopeDeliveryStatus;
  checksum: string;
  sourceLabel: "mesh" | "vertex" | "mock";
  payloadJson: string;
};

export type MeshConsolidatedEvent = {
  id: string;
  atMs: number;
  kind: string;
  summary: string;
  severity: "info" | "warn" | "critical";
  meta?: Record<string, unknown>;
};

export type MeshSurvivalPublicView = {
  missionId: string;
  nowMs: number;
  tickIndex: number;
  /** Active mesh stress preset id (latency/loss/discovery biases). */
  stressPresetId: string;
  constraintMode: NetworkConstraintMode;
  vertexConnectivity: VertexConnectivityMode;
  vertexStress: NetworkStressMode;
  profiles: MeshPeerRichProfile[];
  discovery: {
    entries: {
      observerId: string;
      targetId: string;
      state: DiscoveryPeerState;
      sightings: number;
      ticksSinceSighting: number;
      viaRelay?: string;
    }[];
  };
  graph: MeshOperationalGraph;
  relayPlan: RelayNomination[];
  routePlans: RoutePlan[];
  bus: {
    recent: MeshMessageEnvelope[];
    stats: {
      delivered: number;
      dropped: number;
      buffered: number;
      duplicatesMerged: number;
      rerouted: number;
    };
  };
  recovery: {
    phase: "steady" | "buffering" | "flushing" | "merged";
    pendingFlush: number;
    lastMergeAtMs: number | null;
  };
  ledgerTail: MeshConsolidatedEvent[];
  replay: { atMs: number; label: string; detail: string; severity: "info" | "warn" | "critical" }[];
  liveMode: "mock" | "live";
};

export type MeshSurvivalStepContext = {
  missionId: string;
  nowMs: number;
  tickIndex: number;
  seed: number;
  connectivityMode: VertexConnectivityMode;
  graph: ConnectivitySnapshot;
  nodes: SwarmAgentNode[];
  operatorNodeId: string;
  liveMode: "mock" | "live";
  meshV2: MeshResiliencePublicView;
  /** Latest normalized telemetry batch (optional — improves battery/queue realism). */
  telemetry?: SimTelemetrySample[];
};
