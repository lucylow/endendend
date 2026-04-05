export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Agent {
  id: string;
  name: string;
  role: "explorer" | "relay" | "standby";
  /** Heterogeneous mesh: fast aerial sweep vs heavy ground rescue (Blind Handoff viz). */
  platform?: "aerial" | "ground";
  position: Position;
  battery: number;
  status: "active" | "low-battery" | "offline";
  trajectory: Position[];
  color: string;
  latency: number;
  tasksCompleted: number;
  stakeAmount: number;
  currentBehavior: AgentBehavior;
  assignedCell: GridCell | null;
  targetId: string | null;
  isByzantine: boolean;
  /** Server clock (ms) from last telemetry frame, for live HUD latency */
  lastTelemetryServerMs?: number;

  /** Derived by health engine during sim / telemetry merge */
  healthStatus?: import("@/features/health/types").HealthStatus;
  vitals?: import("@/features/health/types").RobotVitals;
  lastHealthCheck?: number;
  healthHistory?: import("@/features/health/types").HealthHistoryPoint[];
  /** Populated with {@link calculateRobotHealth} issues for HUD */
  healthIssues?: string[];
}

export type AgentBehavior = "idle" | "exploring" | "rescuing" | "relaying" | "returning";

export interface GridCell {
  row: number;
  col: number;
  searched: boolean;
  searchedBy: string | null;
  timestamp: number | null;
}

export interface Target {
  id: string;
  location: Position;
  timestamp: number;
  confidence: number;
  discoveredBy: string;
  status: "discovered" | "assigned" | "rescued" | "resolved" | "pending";
  assignedAgent: string | null;
}

export interface SwarmTask {
  id: string;
  type: "explore_area" | "rescue_victim" | "become_relay";
  params: Record<string, unknown>;
  status: "announced" | "bidding" | "awarded" | "completed" | "failed";
  bids: TaskBid[];
  awardedTo: string | null;
  createdAt: number;
  deadline: number;
}

export interface TaskBid {
  agentId: string;
  score: number;
  distance: number;
  battery: number;
  timestamp: number;
}

export interface RoleHandoff {
  id: string;
  fromAgent: string;
  toAgent: string | null;
  role: Agent["role"];
  reason: string;
  status: "requested" | "accepted" | "completed" | "failed";
  timestamp: number;
}

export interface SwarmData {
  id: string;
  name: string;
  agentCount: number;
  status: "idle" | "exploring" | "coordinating" | "emergency";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "bidding" | "assigned" | "completed";
  reward: number;
  bids: Bid[];
  assignedAgent?: string;
  createdAt: number;
  deadline: number;
}

export interface Bid {
  agentId: string;
  amount: number;
  timestamp: number;
  stake: number;
}

export interface Mission {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: "active" | "completed" | "failed";
  agentCount: number;
  tasksCompleted: number;
  events: MissionEvent[];
}

export interface MissionEvent {
  timestamp: number;
  type:
    | "agent_deployed"
    | "task_assigned"
    | "relay_inserted"
    | "agent_failed"
    | "mission_complete"
    | "target_found"
    | "role_handoff"
    | "rescue_handoff"
    | "cell_searched"
    | "consensus_start"
    | "consensus_success"
    | "consensus_fail"
    | "byzantine_detected"
    | "fault_injected";
  description: string;
  agentId?: string;
}

/** 3D HUD for air-to-ground rescue handoff (Search & Rescue demo). */
export type BlindHandoffPhase = "request" | "bidding" | "accepted" | "complete";

export interface BlindHandoffOverlayState {
  phase: BlindHandoffPhase;
  aerialId: string;
  rescuerId: string | null;
  victim: Position;
  logLines: string[];
}

// BFT Consensus types
export type ConsensusPhase = "idle" | "pre_prepare" | "prepare" | "commit" | "decided" | "failed";

export interface ConsensusInstance {
  id: string;
  seq: number;
  /** PBFT view index for this attempt (primary = activeAgents[view % n]). */
  view: number;
  primaryId: string;
  type: "explorer_election" | "relay_insertion" | "task_acceptance";
  proposedValue: string;
  proposedBy: string;
  phase: ConsensusPhase;
  prepareVotes: string[];
  commitVotes: string[];
  startTime: number;
  endTime: number | null;
  latencyMs: number | null;
  result: "success" | "failure" | "pending";
  byzantineVotes: number;
  /** Monotonic sequence after successful commit (fair ordering log). */
  orderedSeq?: number | null;
}

export interface FaultConfig {
  packetLoss: number;       // 0-100%
  latencyMs: number;        // added latency ms
  byzantineNodes: number;   // count of byzantine agents
  faultType: "drop" | "delay" | "corrupt" | "none";
}

export interface ConsensusMetrics {
  totalAttempts: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  latencyHistory: number[];
  successRateHistory: number[];
  byzantineFaultsDetected: number;
}
