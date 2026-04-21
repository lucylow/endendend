/** Core types for the Dynamic Daisy Chain scenario engine. */

export type MissionPhase =
  | "preflight"
  | "tunnel_entry"
  | "stable"
  | "weakening"
  | "intermittent"
  | "relay_dependent"
  | "partitioned"
  | "recovering"
  | "mission_complete";

export type NodeRoleKind =
  | "lead_explorer"
  | "relay"
  | "indoor_robot"
  | "rescue_robot"
  | "backup_relay"
  | "standby";

export type ConnectivityStatus = "online" | "degraded" | "stale" | "offline";

export interface SensorPackage {
  cameraConfidence: number;
  lidarConfidence: number;
  imuDrift: number;
  audioEchoConfidence: number;
}

export interface NodeProfile {
  id: string;
  displayName: string;
  roleKind: NodeRoleKind;
  relaySuitability: number;
  explorerSuitability: number;
  indoorSuitability: number;
  rescueSuitability: number;
  backupLeadSuitability: number;
  tunnelSuitability: number;
  rangeProfileM: number;
  autonomyLevel: number;
  sensor: SensorPackage;
  fallbackBehavior: "hold" | "retreat" | "relay_boost" | "scout_local";
}

export interface SimNode {
  profile: NodeProfile;
  /** Distance along tunnel axis from entrance (m). */
  s: number;
  lateral: number;
  battery: number;
  role: NodeRoleKind;
  isRelay: boolean;
  relayFrozen: boolean;
  /** When promoted to relay, freeze longitudinal position here. */
  relayHoldS: number | null;
  connectivity: ConnectivityStatus;
  localTask: string;
  lastHeartbeat: number;
  trust: number;
  /** Forwarding load 0–1 (affects battery). */
  forwardLoad: number;
  /** Simulated packet loss to immediate predecessor toward entrance. */
  hopLoss: number;
  /** Latency to predecessor (s). */
  hopLatency: number;
}

export interface TunnelSegment {
  id: string;
  startS: number;
  endS: number;
  label: string;
  /** Extra attenuation multiplier inside segment. */
  attenuationMul: number;
  blocked: boolean;
}

export interface TunnelGeometry {
  lengthM: number;
  widthM: number;
  entranceS: number;
  segments: TunnelSegment[];
  collapsePoints: number[];
  relayAnchorZones: { startS: number; endS: number; id: string }[];
  signalShadowZones: { startS: number; endS: number; lossAdd: number }[];
  frontierPoints: number[];
  targetZones: { startS: number; endS: number; id: string }[];
  returnCheckpoints: number[];
}

export interface SignalHop {
  fromId: string;
  toId: string;
  loss: number;
  latencySec: number;
  jitterMs: number;
  boostedByRelay: boolean;
}

export interface MapCell {
  s: number;
  kind: "unexplored" | "explored" | "relay_anchor" | "target" | "blocked" | "frontier" | "stale";
}

export interface TunnelMapState {
  cells: MapCell[];
  coverage: number;
  frontierS: number;
}

export type SwarmTaskStatus = "open" | "bidding" | "assigned" | "completed" | "failed";

export interface SwarmTask {
  id: string;
  title: string;
  status: SwarmTaskStatus;
  priority: number;
  assigneeId: string | null;
  fallbackIds: string[];
  createdAt: number;
}

export type DaisyEventType =
  | "mission_start"
  | "tunnel_entry"
  | "frontier_advance"
  | "signal_degrade"
  | "relay_selected"
  | "relay_activated"
  | "map_delta"
  | "target_candidate"
  | "target_confirmed"
  | "relay_drop"
  | "fallback_relay"
  | "recovery_sync"
  | "mission_retreat"
  | "mission_complete"
  | "role_handoff"
  | "task_reassigned";

export interface DaisyEvent {
  id: string;
  t: number;
  type: DaisyEventType;
  message: string;
  nodeIds: string[];
  meta?: Record<string, number | string | boolean>;
}

export interface TelemetrySample {
  nodeId: string;
  t: number;
  positionS: number;
  velocity: number;
  battery: number;
  linkIngress: number;
  linkToLead: number;
  packetLoss: number;
  latencyMs: number;
  gpsConfidence: number;
  lidarConfidence: number;
  dust: number;
  temperatureC: number;
  obstacleProximity: number;
}

export interface CollectiveMapDelta {
  t: number;
  exploredUpToS: number;
  contributorId: string;
}

export interface EngineConfig {
  seed: number;
  tunnel: TunnelGeometry;
  tickHz: number;
  explorerSpeed: number;
  followerCreep: number;
  minRelaySpacingM: number;
  relayLossThreshold: number;
  partitionLossThreshold: number;
  batteryDrainExplorer: number;
  batteryDrainRelay: number;
  batteryDrainIdle: number;
  targetDiscoveryChancePerSec: number;
  forcedRelayFailure?: { nodeId: string; atT: number } | null;
}

export interface ScenarioVariantId {
  id:
    | "default"
    | "deep"
    | "narrow"
    | "collapsed"
    | "noisy"
    | "relay_heavy"
    | "target_rich";
}

export interface RelayPlanResult {
  orderedRelayIds: string[];
  chainPath: string[];
  ingressQuality: number;
  leadQuality: number;
  notes: string[];
}

export interface EngineSnapshot {
  t: number;
  phase: MissionPhase;
  nodes: SimNode[];
  relayPlan: RelayPlanResult;
  map: TunnelMapState;
  tasks: SwarmTask[];
  events: DaisyEvent[];
  telemetry: TelemetrySample[];
  collectiveDeltas: CollectiveMapDelta[];
  signalHops: SignalHop[];
  rngStream: number;
}
