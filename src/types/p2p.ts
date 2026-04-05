// ===== Peer-to-Peer Coordination Types =====

export type PeerStatus = "active" | "stale" | "dead";

export type ChainHealth = "forming" | "stable" | "repairing" | "degraded" | "solo";

export interface PeerInfo {
  nodeId: string;
  name: string;
  status: PeerStatus;
  lastHeartbeat: number;
  /** When status became stale (for hysteresis / debugging). */
  staleSince?: number;
  depth: number;
  role: "explorer" | "relay" | "standby";
  explorerVersion: number;
  /** Wall-clock ms when this node last became explorer (conflict resolution). */
  explorerSince: number;
  partitionId: string;
  battery: number;
  position: { x: number; y: number; z: number };
}

export interface GossipMessage {
  id: string;
  type:
    | "GOSSIP_PEERS"
    | "HEARTBEAT"
    | "ROLE_ANNOUNCE"
    | "ELECTION_QUERY"
    | "ELECTION_VOTE"
    | "STATE_UPDATE"
    | "STATE_SYNC_REQUEST"
    | "STATE_SYNC_RESPONSE"
    | "STATE_VECTOR"
    | "STATE_REQUEST"
    | "STATE_RESPONSE"
    | "STATE_SNAPSHOT"
    | "VOLUNTEER_RELAY"
    | "BYPASS_REQUEST"
    | "BYPASS_ACK"
    | "CHAIN_UPDATE"
    | "CHAIN_REPAIR_REQUEST"
    | "PARTITION_MERGE"
    | "CONSENSUS_PROPOSE"
    | "LEAVING"
    | "TAKEOVER"
    | "TAKEOVER_ACK"
    | "DISCOVER"
    | "MESSAGE_ACK";
  source: string;
  target: string | "broadcast";
  payload: Record<string, unknown>;
  timestamp: number;
  ttl: number;
}

export interface RelayChainState {
  chain: string[];
  version: number;
  updatedAt: number;
  updatedBy: string;
  /** Last stable chain before partition / solo (shadow chain). */
  shadowChain?: string[];
  chainHealth?: ChainHealth;
}

export interface StateEntry {
  key: string;
  value: unknown;
  version: number;
  updatedBy: string;
  timestamp: number;
}

export interface VersionVector {
  nodeId: string;
  versions: Record<string, number>;
}

export interface ElectionState {
  candidateId: string;
  depth: number;
  explorerVersion: number;
  votes: string[];
  quorumNeeded: number;
  status: "voting" | "won" | "lost" | "timeout";
  startedAt: number;
}

export interface PartitionInfo {
  id: string;
  members: string[];
  explorerId: string | null;
  explorerVersion: number;
  detectedAt: number;
}

export interface ChainRepairAttempt {
  id: string;
  failedNode: string;
  predecessor: string | null;
  successor: string | null;
  strategy: "bypass" | "rebuild" | "volunteer";
  status: "attempting" | "success" | "failed";
  timestamp: number;
}

export interface P2PMetrics {
  gossipMessagesSent: number;
  gossipMessagesReceived: number;
  heartbeatsSent: number;
  heartbeatsReceived: number;
  peersDiscovered: number;
  staleTransitions: number;
  deadTransitions: number;
  electionsHeld: number;
  electionsWon: number;
  chainRepairsAttempted: number;
  chainRepairsSucceeded: number;
  partitionsDetected: number;
  partitionsMerged: number;
  stateSyncsCompleted: number;
  volunteerRelays: number;
  bypassAttempts: number;
  bypassSuccesses: number;
  messageLatencyAvg: number;
  messageLatencyHistory: number[];
  stateMergesCompleted: number;
  reliableDeliveries: number;
  reliableFailures: number;
  stateSnapshotsBroadcast: number;
  discoverBroadcasts: number;
}

export interface CoordinationEvent {
  id: string;
  timestamp: number;
  type:
    | "peer_discovered"
    | "peer_stale"
    | "peer_dead"
    | "gossip_sent"
    | "gossip_received"
    | "heartbeat_sent"
    | "heartbeat_timeout"
    | "election_started"
    | "election_won"
    | "election_lost"
    | "role_change"
    | "chain_updated"
    | "chain_repair_start"
    | "chain_repair_success"
    | "chain_repair_fail"
    | "partition_detected"
    | "partition_merged"
    | "state_sync"
    | "state_conflict"
    | "volunteer_relay"
    | "bypass_attempt"
    | "bypass_success"
    | "bypass_fail"
    | "solo_mode_entered"
    | "solo_mode_exited"
    | "state_merge"
    | "meet_greet"
    | "peer_leaving"
    | "explorer_takeover"
    | "discover_sent"
    | "reliable_degraded";
  description: string;
  nodeId?: string;
  details?: Record<string, unknown>;
}

/** Payload for STATE_REQUEST / STATE_RESPONSE gossip. */
export interface SwarmStatePayload {
  drones: Array<{
    id: string;
    name: string;
    depth: number;
    role: PeerInfo["role"];
    timestamp: number;
    explorerSince: number;
    battery: number;
    status: PeerStatus;
  }>;
  chain: string[];
  shadowChain: string[];
  explorerId: string | null;
  chainHealth: ChainHealth;
  savedAt: number;
}
