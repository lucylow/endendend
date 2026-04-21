import type { ConnectivitySnapshot, SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { VertexConnectivityMode } from "@/backend/shared/mission-state";

/** Extended mesh-facing roles (Vertex / Lattice narrative); map to base swarm roles in UI where needed. */
export type Vertex2MeshRole =
  | "explorer"
  | "relay"
  | "triage"
  | "rescuer"
  | "standby"
  | "coordinator"
  | "sensor"
  | "transport"
  | "emergency"
  | "carrier"
  | "medic"
  | "observer";

export type Vertex2NodeKind =
  | "scout_drone"
  | "relay_drone"
  | "indoor_robot"
  | "rescue_robot"
  | "coordinator_node"
  | "backup_relay"
  | "sensor_node"
  | "transport_node";

export type PeerHealth = "ok" | "degraded" | "isolated" | "offline" | "recovering";

export type RecoveryPhase = "steady" | "buffering" | "reconciling" | "merged";

export type NetworkStressMode =
  | "normal"
  | "degraded"
  | "high_latency"
  | "lossy"
  | "partitioned"
  | "recovery"
  | "offline";

export type MeshLedgerEventType =
  | "peer_discovered"
  | "heartbeat_mesh"
  | "topology_changed"
  | "proposal_created"
  | "task_mesh_opened"
  | "task_mesh_assigned"
  | "role_mesh_handoff"
  | "consensus_vote"
  | "consensus_committed"
  | "consensus_rejected"
  | "packet_loss_sim"
  | "delay_spike"
  | "partition_start"
  | "partition_end"
  | "recovery_sync"
  | "checkpoint_saved"
  | "replay_commit";

export type CommitmentStatus = "pending" | "committed" | "rejected" | "superseded";

export type MeshLedgerEvent = {
  id: string;
  timestamp: number;
  missionId: string;
  actorPeerId: string;
  previousHash: string;
  eventHash: string;
  eventType: MeshLedgerEventType;
  payload: Record<string, unknown>;
  sourceLabel: "vertex" | "lattice" | "meshnet" | "arc";
  commitmentStatus: CommitmentStatus;
  /** Proof-of-Coordination placeholder: Merkle leaf over payload core. */
  proofHint?: string;
};

export type NetworkConditionVector = {
  baseLatencyMs: number;
  jitterMs: number;
  loss01: number;
  dup01: number;
  reorder01: number;
  ackDelayMs: number;
  timeoutChance01: number;
  staleDelivery01: number;
  retransmitPressure01: number;
  routeInstability01: number;
};

export type MeshPeerRuntime = {
  peerId: string;
  displayName: string;
  nodeKind: Vertex2NodeKind;
  meshRole: Vertex2MeshRole;
  vendorModel: string;
  trust01: number;
  health: PeerHealth;
  battery01: number;
  heartbeatIntervalMs: number;
  latencyBiasMs: number;
  lossSensitivity01: number;
  localAutonomy01: number;
  queueDepth: number;
  relayScore01: number;
  lastNeighbors: string[];
  knownPeers: string[];
  reachablePeers: string[];
  suspectedPeers: string[];
  stalePeers: string[];
  newlyDiscovered: string[];
  missionNote: string;
  partitionId: string;
  recovery: RecoveryPhase;
  /** Simulated malicious / flaky vote behavior for BFT stress (bounded). */
  byzantineLike01: number;
};

export type MeshLinkQuality = {
  a: string;
  b: string;
  latencyMs: number;
  loss01: number;
  quality01: number;
  viaRelay?: string;
  isBridge: boolean;
  partitionA?: string;
  partitionB?: string;
};

export type MeshGraphView = {
  nodes: string[];
  links: MeshLinkQuality[];
  bridges: string[];
  relayRank: { peerId: string; score01: number }[];
  operatorReachable: string[];
  isolated: string[];
  partitionLabels: Record<string, string>;
};

export type ConsensusProposalView = {
  id: string;
  summary: string;
  createdAtMs: number;
  votesYes: number;
  votesNo: number;
  votesPending: number;
  quorumNeed: number;
  status: "pending" | "committed" | "rejected";
  commitLatencyMs?: number;
};

export type MeshConsensusHealth = {
  sequence: number;
  lastCommitHash?: string;
  pending: number;
  committed: number;
  rejected: number;
  stress01: number;
};

export type TaskAllocationRecord = {
  taskId: string;
  winnerId: string;
  score: number;
  reasons: string[];
  fallbacks: string[];
  atMs: number;
};

export type RoleHandoffMeshRecord = {
  peerId: string;
  from: Vertex2MeshRole;
  to: Vertex2MeshRole;
  reason: string;
  atMs: number;
};

export type ReplayNarrativeEntry = {
  atMs: number;
  label: string;
  detail: string;
  severity: "info" | "warn" | "critical";
};

export type MeshResiliencePublicView = {
  missionId: string;
  nowMs: number;
  seed: number;
  stressMode: NetworkStressMode;
  connectivityMode: VertexConnectivityMode;
  peers: MeshPeerRuntime[];
  graph: MeshGraphView;
  discoveryPulse: number;
  consensus: {
    health: MeshConsensusHealth;
    proposals: ConsensusProposalView[];
  };
  ledgerTail: MeshLedgerEvent[];
  replay: ReplayNarrativeEntry[];
  taskHistory: TaskAllocationRecord[];
  roleHistory: RoleHandoffMeshRecord[];
  checkpoints: string[];
  stats: {
    deliveredVotes: number;
    droppedVotes: number;
    delayedDeliveries: number;
    duplicates: number;
    bufferedWhileOffline: number;
    reroutes: number;
  };
  liveMode: "mock" | "live";
};

export type MeshStepContext = {
  missionId: string;
  nowMs: number;
  seed: number;
  tickIndex: number;
  connectivityMode: VertexConnectivityMode;
  graph: ConnectivitySnapshot;
  nodes: SwarmAgentNode[];
  operatorNodeId: string;
  telemetryQueueByNode?: Record<string, number>;
  liveMode: "mock" | "live";
};

export function stressModeFromVertex(mode: VertexConnectivityMode): NetworkStressMode {
  switch (mode) {
    case "normal":
      return "normal";
    case "degraded":
      return "degraded";
    case "partial_partition":
      return "partitioned";
    case "blackout":
      return "offline";
    case "recovery":
    case "resync":
      return "recovery";
    default:
      return "normal";
  }
}
