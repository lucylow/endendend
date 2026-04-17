/**
 * Lattice + rewards backend for Tashi SAR swarm integration.
 * ---------------------------------------------------------
 * This module focuses on the Lattice side of the Tashi stack:
 *
 * - node discovery and capability registry
 * - health tracking and trust/reputation scoring
 * - scenario-aware work assignment
 * - reward attribution from verified contribution
 * - triangulated validation / peer attestations
 * - reward accounting with auditable proofs
 * - selection helpers so Vertex can ask: "who should do this next?"
 *
 * The intent is to keep Vertex as the agreement layer and make Lattice the
 * infrastructure layer that validates work, scores reliability, and tracks
 * rewards earned through verified contribution.
 */

import { createHash } from "node:crypto";

export type NodeId = string;
export type MissionId = string;
export type TaskId = string;
export type TargetId = string;
export type EventId = string;
export type RewardId = string;
export type ProofId = string;
export type TimestampMs = number;

export enum ScenarioKind {
  CollapsedBuilding = "collapsed_building",
  CaveTunnel = "cave_tunnel",
  Flood = "flood",
  Wildfire = "wildfire",
  Industrial = "industrial",
  Forest = "forest",
  Night = "night",
  Indoor = "indoor",
  Perimeter = "perimeter",
  Triage = "triage",
}

export enum NodeRole {
  Explorer = "explorer",
  Relay = "relay",
  Triage = "triage",
  Rescuer = "rescuer",
  Standby = "standby",
  Command = "command",
  Sensor = "sensor",
  Transport = "transport",
  Emergency = "emergency",
}

export enum HealthStatus {
  Healthy = "healthy",
  Degraded = "degraded",
  Unhealthy = "unhealthy",
  Offline = "offline",
  Unknown = "unknown",
}

export enum ValidationType {
  Discovery = "discovery",
  Capability = "capability",
  TaskCompletion = "task_completion",
  RelayContinuity = "relay_continuity",
  VictimConfirmation = "victim_confirmation",
  Extraction = "extraction",
  GeofenceBreach = "geofence_breach",
  Reconnect = "reconnect",
  MapContribution = "map_contribution",
  SafetyResponse = "safety_response",
}

export enum RewardKind {
  Work = "work",
  Relay = "relay",
  Discovery = "discovery",
  Rescue = "rescue",
  Validation = "validation",
  Recovery = "recovery",
  Safety = "safety",
  Bonus = "bonus",
  Penalty = "penalty",
}

export enum CapabilityTag {
  Camera = "camera",
  Thermal = "thermal",
  IR = "ir",
  GPS = "gps",
  IMU = "imu",
  Lidar = "lidar",
  SmokeResistant = "smoke_resistant",
  HighTemp = "high_temp",
  Waterproof = "waterproof",
  Relay = "relay",
  Indoor = "indoor",
  Outdoor = "outdoor",
  LongRange = "long_range",
  Compact = "compact",
  GasSensor = "gas_sensor",
  Barometer = "barometer",
  Audio = "audio",
  Gripper = "gripper",
  Payload = "payload",
  /** Matches transport / hauler platforms (aligns with NodeRole.Transport). */
  Transport = "transport",
}

export interface XYPoint {
  x: number;
  y: number;
  z?: number;
}

export interface NodeEndpoint {
  host: string;
  port: number;
  scheme?: "mqtt" | "mqtts" | "ws" | "wss";
}

export interface NodeHealthSample {
  timestampMs: TimestampMs;
  batteryPct: number;
  cpuPct: number;
  memoryPct: number;
  linkQuality: number;
  gpsFix: boolean;
  temperatureC?: number;
  missionId?: MissionId | null;
  status: HealthStatus;
}

export interface CapabilityProfile {
  tags: CapabilityTag[];
  sensorStack: string[];
  maxRangeM: number;
  maxAltitudeM: number;
  indoorSuitability: number; // 0..1
  outdoorSuitability: number; // 0..1
  hazardClearance: string[];
  notes?: Record<string, unknown>;
}

export interface NodeProfile {
  nodeId: NodeId;
  displayName: string;
  role: NodeRole;
  endpoint?: NodeEndpoint | null;
  publicKey: string;
  vendor?: string;
  model?: string;
  location?: XYPoint | null;
  capabilityProfile: CapabilityProfile;
  health: NodeHealthSample;
  trustScore: number;
  reputationScore: number;
  rewardPoints: number;
  contributionCount: number;
  successfulTasks: number;
  failedTasks: number;
  lastSeenMs: TimestampMs;
  firstSeenMs: TimestampMs;
  missionId?: MissionId | null;
  metadata?: Record<string, unknown>;
}

export interface ValidationProof {
  proofId: ProofId;
  validationType: ValidationType;
  missionId: MissionId;
  taskId?: TaskId | null;
  targetId?: TargetId | null;
  subjectNodeId: NodeId;
  witnesses: NodeId[];
  evidence: Record<string, unknown>;
  createdAtMs: TimestampMs;
  accepted: boolean;
  reason: string;
  sourceHashes: string[];
}

export interface ContributionEvent {
  eventId: EventId;
  missionId: MissionId;
  nodeId: NodeId;
  kind: RewardKind;
  label: string;
  proofId?: ProofId | null;
  taskId?: TaskId | null;
  targetId?: TargetId | null;
  weight: number;
  createdAtMs: TimestampMs;
  metadata: Record<string, unknown>;
}

export interface RewardEvent {
  rewardId: RewardId;
  missionId: MissionId;
  nodeId: NodeId;
  kind: RewardKind;
  amount: number;
  reason: string;
  proofId?: ProofId | null;
  contributionEventId?: EventId | null;
  createdAtMs: TimestampMs;
  settled: boolean;
  metadata: Record<string, unknown>;
}

export interface WorkItem {
  taskId: TaskId;
  missionId: MissionId;
  scenario: ScenarioKind;
  taskType: string;
  requirements: Record<string, unknown>;
  priority: number;
  location?: XYPoint | null;
  requiredCapabilities: CapabilityTag[];
  minTrustScore: number;
  minBatteryPct: number;
  maxDistanceM?: number;
  rescueTargetId?: TargetId | null;
  createdAtMs: TimestampMs;
  expiresAtMs: TimestampMs;
  assignedNodeId?: NodeId | null;
  metadata: Record<string, unknown>;
}

export interface AssignmentCandidate {
  nodeId: NodeId;
  score: number;
  reasons: string[];
  estimatedEtaMs: number;
}

export interface ScenarioPolicy {
  scenario: ScenarioKind;
  minNodes: number;
  requiredRoles: Partial<Record<NodeRole, number>>;
  capabilityWeights: Partial<Record<CapabilityTag, number>>;
  trustWeight: number;
  batteryWeight: number;
  distanceWeight: number;
  linkWeight: number;
  healthWeight: number;
  indoorBias: number;
  outdoorBias: number;
  rewardMultipliers: Partial<Record<RewardKind, number>>;
  hazardRequirements: string[];
}

export interface NodeDiscoveryEvent {
  nodeId: NodeId;
  discoveredBy: NodeId;
  missionId?: MissionId | null;
  seenAtMs: TimestampMs;
  endpoint?: NodeEndpoint | null;
  location?: XYPoint | null;
  metadata?: Record<string, unknown>;
}

export interface PeerAttestation {
  witnessId: NodeId;
  subjectNodeId: NodeId;
  validationType: ValidationType;
  accepted: boolean;
  reason: string;
  timestampMs: TimestampMs;
  evidenceHash: string;
}

export interface RewardLedgerEntry {
  reward: RewardEvent;
  updatedTrustScore: number;
  updatedReputationScore: number;
  balanceAfter: number;
}

export interface LatticeHealthSummary {
  nodeCount: number;
  healthyCount: number;
  degradedCount: number;
  offlineCount: number;
  averageTrustScore: number;
  averageReputationScore: number;
  totalRewardPoints: number;
  recentProofCount: number;
  recentContributionCount: number;
}

export function nowMs(): TimestampMs {
  return Date.now();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function euclideanDistance(a: XYPoint, b: XYPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z ?? 0) - (b.z ?? 0)) ** 2);
}

/** Deterministic JSON for hashing (sorted keys, cycle-safe). */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const helper = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    if (seen.has(input as object)) return "[Circular]";
    seen.add(input as object);
    if (Array.isArray(input)) return input.map(helper);
    const record = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = helper(record[key]);
    return out;
  };
  return JSON.stringify(helper(value));
}

export function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashObject(input: unknown): string {
  return hashText(stableStringify(input));
}

export function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16)}`;
}

function deriveHealthStatus(h: Pick<NodeHealthSample, "batteryPct" | "linkQuality" | "cpuPct" | "memoryPct">): HealthStatus {
  if (h.batteryPct < 6 || h.linkQuality < 0.08) return HealthStatus.Unhealthy;
  if (h.batteryPct < 22 || h.linkQuality < 0.35 || h.cpuPct > 88 || h.memoryPct > 88) return HealthStatus.Degraded;
  return HealthStatus.Healthy;
}

function scenarioDefaultPolicy(scenario: ScenarioKind): ScenarioPolicy {
  switch (scenario) {
    case ScenarioKind.CollapsedBuilding:
      return {
        scenario,
        minNodes: 5,
        requiredRoles: { [NodeRole.Explorer]: 2, [NodeRole.Relay]: 1, [NodeRole.Triage]: 1, [NodeRole.Rescuer]: 1 },
        capabilityWeights: {
          [CapabilityTag.Indoor]: 3,
          [CapabilityTag.Camera]: 2,
          [CapabilityTag.IMU]: 2,
          [CapabilityTag.GPS]: 1,
          [CapabilityTag.Lidar]: 2,
          [CapabilityTag.Compact]: 2,
          [CapabilityTag.Relay]: 2,
        },
        trustWeight: 0.24,
        batteryWeight: 0.18,
        distanceWeight: 0.22,
        linkWeight: 0.12,
        healthWeight: 0.24,
        indoorBias: 0.4,
        outdoorBias: 0.1,
        rewardMultipliers: {
          [RewardKind.Work]: 1.0,
          [RewardKind.Rescue]: 1.4,
          [RewardKind.Relay]: 1.2,
          [RewardKind.Validation]: 1.1,
          [RewardKind.Recovery]: 1.1,
        },
        hazardRequirements: ["collapse", "dust", "low_light"],
      };
    case ScenarioKind.CaveTunnel:
      return {
        scenario,
        minNodes: 4,
        requiredRoles: { [NodeRole.Explorer]: 1, [NodeRole.Relay]: 2, [NodeRole.Rescuer]: 1 },
        capabilityWeights: {
          [CapabilityTag.Relay]: 3,
          [CapabilityTag.LongRange]: 2,
          [CapabilityTag.Compact]: 2,
          [CapabilityTag.IMU]: 2,
          [CapabilityTag.Lidar]: 2,
          [CapabilityTag.GPS]: 1,
          [CapabilityTag.Indoor]: 2,
        },
        trustWeight: 0.25,
        batteryWeight: 0.14,
        distanceWeight: 0.18,
        linkWeight: 0.2,
        healthWeight: 0.23,
        indoorBias: 0.5,
        outdoorBias: 0.0,
        rewardMultipliers: {
          [RewardKind.Work]: 1.0,
          [RewardKind.Relay]: 1.6,
          [RewardKind.Validation]: 1.2,
          [RewardKind.Recovery]: 1.1,
        },
        hazardRequirements: ["gps_loss", "narrow_passage", "link_loss"],
      };
    case ScenarioKind.Flood:
      return {
        scenario,
        minNodes: 6,
        requiredRoles: {
          [NodeRole.Explorer]: 1,
          [NodeRole.Transport]: 2,
          [NodeRole.Rescuer]: 2,
          [NodeRole.Relay]: 1,
        },
        capabilityWeights: {
          [CapabilityTag.Waterproof]: 4,
          [CapabilityTag.Payload]: 3,
          [CapabilityTag.Transport]: 3,
          [CapabilityTag.Camera]: 1,
          [CapabilityTag.GPS]: 2,
        },
        trustWeight: 0.23,
        batteryWeight: 0.2,
        distanceWeight: 0.18,
        linkWeight: 0.12,
        healthWeight: 0.27,
        indoorBias: 0.0,
        outdoorBias: 0.4,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Rescue]: 1.5, [RewardKind.Recovery]: 1.2 },
        hazardRequirements: ["water", "current", "storm"],
      };
    case ScenarioKind.Wildfire:
      return {
        scenario,
        minNodes: 6,
        requiredRoles: { [NodeRole.Explorer]: 2, [NodeRole.Relay]: 1, [NodeRole.Triage]: 2, [NodeRole.Rescuer]: 1 },
        capabilityWeights: {
          [CapabilityTag.Thermal]: 4,
          [CapabilityTag.SmokeResistant]: 4,
          [CapabilityTag.HighTemp]: 4,
          [CapabilityTag.IR]: 2,
          [CapabilityTag.Camera]: 1,
          [CapabilityTag.LongRange]: 1,
        },
        trustWeight: 0.22,
        batteryWeight: 0.16,
        distanceWeight: 0.16,
        linkWeight: 0.12,
        healthWeight: 0.34,
        indoorBias: 0.0,
        outdoorBias: 0.5,
        rewardMultipliers: {
          [RewardKind.Work]: 1.0,
          [RewardKind.Rescue]: 1.6,
          [RewardKind.Validation]: 1.2,
          [RewardKind.Safety]: 1.25,
        },
        hazardRequirements: ["heat", "smoke", "rapid_change"],
      };
    case ScenarioKind.Industrial:
      return {
        scenario,
        minNodes: 5,
        requiredRoles: { [NodeRole.Explorer]: 1, [NodeRole.Relay]: 1, [NodeRole.Triage]: 1, [NodeRole.Sensor]: 2 },
        capabilityWeights: {
          [CapabilityTag.GasSensor]: 4,
          [CapabilityTag.Barometer]: 2,
          [CapabilityTag.Camera]: 2,
          [CapabilityTag.IMU]: 1,
          [CapabilityTag.Indoor]: 2,
        },
        trustWeight: 0.24,
        batteryWeight: 0.16,
        distanceWeight: 0.17,
        linkWeight: 0.13,
        healthWeight: 0.3,
        indoorBias: 0.2,
        outdoorBias: 0.0,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Validation]: 1.1, [RewardKind.Safety]: 1.3 },
        hazardRequirements: ["hazmat", "toxic", "sparks"],
      };
    case ScenarioKind.Forest:
      return {
        scenario,
        minNodes: 5,
        requiredRoles: { [NodeRole.Explorer]: 2, [NodeRole.Relay]: 1, [NodeRole.Rescuer]: 2 },
        capabilityWeights: {
          [CapabilityTag.LongRange]: 4,
          [CapabilityTag.Camera]: 2,
          [CapabilityTag.GPS]: 2,
          [CapabilityTag.Thermal]: 1,
          [CapabilityTag.Outdoor]: 3,
        },
        trustWeight: 0.2,
        batteryWeight: 0.2,
        distanceWeight: 0.22,
        linkWeight: 0.12,
        healthWeight: 0.26,
        indoorBias: 0.0,
        outdoorBias: 0.5,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Discovery]: 1.2, [RewardKind.Rescue]: 1.3 },
        hazardRequirements: ["wide_area", "terrain", "weather"],
      };
    case ScenarioKind.Night:
      return {
        scenario,
        minNodes: 4,
        requiredRoles: { [NodeRole.Explorer]: 1, [NodeRole.Relay]: 1, [NodeRole.Rescuer]: 2 },
        capabilityWeights: { [CapabilityTag.IR]: 4, [CapabilityTag.Camera]: 2, [CapabilityTag.Lidar]: 2, [CapabilityTag.GPS]: 1 },
        trustWeight: 0.2,
        batteryWeight: 0.16,
        distanceWeight: 0.18,
        linkWeight: 0.12,
        healthWeight: 0.34,
        indoorBias: 0.15,
        outdoorBias: 0.25,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Rescue]: 1.2 },
        hazardRequirements: ["darkness", "line_of_sight", "fatigue"],
      };
    case ScenarioKind.Indoor:
      return {
        scenario,
        minNodes: 4,
        requiredRoles: { [NodeRole.Explorer]: 2, [NodeRole.Triage]: 1, [NodeRole.Relay]: 1 },
        capabilityWeights: {
          [CapabilityTag.Indoor]: 4,
          [CapabilityTag.Compact]: 3,
          [CapabilityTag.Camera]: 2,
          [CapabilityTag.IMU]: 2,
          [CapabilityTag.Lidar]: 2,
        },
        trustWeight: 0.24,
        batteryWeight: 0.16,
        distanceWeight: 0.2,
        linkWeight: 0.12,
        healthWeight: 0.28,
        indoorBias: 0.5,
        outdoorBias: 0.0,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Discovery]: 1.2, [RewardKind.Validation]: 1.1 },
        hazardRequirements: ["stairwell", "doorways", "gps_loss"],
      };
    case ScenarioKind.Perimeter:
      return {
        scenario,
        minNodes: 4,
        requiredRoles: { [NodeRole.Explorer]: 1, [NodeRole.Relay]: 1, [NodeRole.Sensor]: 2 },
        capabilityWeights: {
          [CapabilityTag.LongRange]: 3,
          [CapabilityTag.Camera]: 2,
          [CapabilityTag.GPS]: 2,
          [CapabilityTag.Outdoor]: 2,
        },
        trustWeight: 0.2,
        batteryWeight: 0.18,
        distanceWeight: 0.24,
        linkWeight: 0.12,
        healthWeight: 0.26,
        indoorBias: 0.0,
        outdoorBias: 0.4,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Discovery]: 1.1, [RewardKind.Validation]: 1.1 },
        hazardRequirements: ["boundary", "unauthorized", "outlier"],
      };
    case ScenarioKind.Triage:
      return {
        scenario,
        minNodes: 5,
        requiredRoles: { [NodeRole.Explorer]: 1, [NodeRole.Triage]: 2, [NodeRole.Rescuer]: 2 },
        capabilityWeights: {
          [CapabilityTag.Camera]: 2,
          [CapabilityTag.Audio]: 2,
          [CapabilityTag.GPS]: 1,
          [CapabilityTag.Indoor]: 2,
          [CapabilityTag.IR]: 1,
        },
        trustWeight: 0.22,
        batteryWeight: 0.16,
        distanceWeight: 0.2,
        linkWeight: 0.12,
        healthWeight: 0.3,
        indoorBias: 0.25,
        outdoorBias: 0.15,
        rewardMultipliers: { [RewardKind.Work]: 1.0, [RewardKind.Rescue]: 1.5, [RewardKind.Validation]: 1.2 },
        hazardRequirements: ["multiple_victims", "priority", "capacity"],
      };
    default:
      return {
        scenario,
        minNodes: 4,
        requiredRoles: { [NodeRole.Explorer]: 1, [NodeRole.Relay]: 1 },
        capabilityWeights: { [CapabilityTag.Camera]: 1, [CapabilityTag.GPS]: 1 },
        trustWeight: 0.25,
        batteryWeight: 0.25,
        distanceWeight: 0.25,
        linkWeight: 0.1,
        healthWeight: 0.15,
        indoorBias: 0.1,
        outdoorBias: 0.1,
        rewardMultipliers: { [RewardKind.Work]: 1.0 },
        hazardRequirements: [],
      };
  }
}

export class NodeRegistry {
  private readonly nodes = new Map<NodeId, NodeProfile>();
  private readonly discoveries: NodeDiscoveryEvent[] = [];
  private readonly attestations: PeerAttestation[] = [];
  private readonly history: Array<{ type: string; tsMs: TimestampMs; payload: Record<string, unknown> }> = [];

  constructor(private readonly policies = new Map<ScenarioKind, ScenarioPolicy>()) {}

  policyFor(scenario: ScenarioKind): ScenarioPolicy {
    const existing = this.policies.get(scenario);
    if (existing) return existing;
    const generated = scenarioDefaultPolicy(scenario);
    this.policies.set(scenario, generated);
    return generated;
  }

  register(node: NodeProfile): NodeProfile {
    const current = this.nodes.get(node.nodeId);
    if (!current || node.lastSeenMs >= current.lastSeenMs) {
      this.nodes.set(node.nodeId, this.normalize(node));
      this.history.push({ type: "register", tsMs: nowMs(), payload: { nodeId: node.nodeId, role: node.role } });
    }
    return this.nodes.get(node.nodeId)!;
  }

  get(nodeId: NodeId): NodeProfile | null {
    return this.nodes.get(nodeId) ?? null;
  }

  all(): NodeProfile[] {
    return [...this.nodes.values()].sort((a, b) => b.lastSeenMs - a.lastSeenMs);
  }

  active(thresholdMs = 15_000): NodeProfile[] {
    const now = nowMs();
    return this.all().filter((node) => now - node.lastSeenMs < thresholdMs && node.health.status !== HealthStatus.Offline);
  }

  stale(thresholdMs = 15_000): NodeProfile[] {
    const now = nowMs();
    return this.all().filter((node) => now - node.lastSeenMs >= thresholdMs || node.health.status === HealthStatus.Offline);
  }

  remove(nodeId: NodeId): boolean {
    const removed = this.nodes.delete(nodeId);
    if (removed) this.history.push({ type: "remove", tsMs: nowMs(), payload: { nodeId } });
    return removed;
  }

  discovery(event: NodeDiscoveryEvent): NodeProfile {
    this.discoveries.push(event);
    const existing = this.nodes.get(event.nodeId);
    const baseHealth: NodeHealthSample = existing?.health
      ? { ...existing.health }
      : {
          timestampMs: event.seenAtMs,
          batteryPct: 100,
          cpuPct: 0,
          memoryPct: 0,
          linkQuality: 1,
          gpsFix: true,
          status: HealthStatus.Healthy,
        };
    baseHealth.status = baseHealth.status && baseHealth.status !== HealthStatus.Unknown ? baseHealth.status : deriveHealthStatus(baseHealth);
    const node = this.normalize({
      nodeId: event.nodeId,
      displayName: existing?.displayName ?? event.nodeId,
      role: existing?.role ?? NodeRole.Standby,
      endpoint: event.endpoint ?? existing?.endpoint ?? null,
      publicKey: existing?.publicKey ?? "",
      vendor: existing?.vendor,
      model: existing?.model,
      location: event.location ?? existing?.location ?? null,
      capabilityProfile: existing?.capabilityProfile ?? {
        tags: [],
        sensorStack: [],
        maxRangeM: 0,
        maxAltitudeM: 0,
        indoorSuitability: 0.5,
        outdoorSuitability: 0.5,
        hazardClearance: [],
      },
      health: baseHealth,
      trustScore: existing?.trustScore ?? 0.5,
      reputationScore: existing?.reputationScore ?? 0.5,
      rewardPoints: existing?.rewardPoints ?? 0,
      contributionCount: existing?.contributionCount ?? 0,
      successfulTasks: existing?.successfulTasks ?? 0,
      failedTasks: existing?.failedTasks ?? 0,
      lastSeenMs: event.seenAtMs,
      firstSeenMs: existing?.firstSeenMs ?? event.seenAtMs,
      missionId: event.missionId ?? existing?.missionId ?? null,
      metadata: { ...(existing?.metadata ?? {}), ...(event.metadata ?? {}) },
    });
    this.nodes.set(node.nodeId, node);
    this.history.push({ type: "discovery", tsMs: nowMs(), payload: { nodeId: node.nodeId, discoveredBy: event.discoveredBy } });
    return node;
  }

  updateHealth(nodeId: NodeId, patch: Partial<Omit<NodeHealthSample, "status">> & { status?: HealthStatus }): NodeProfile | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    const merged: NodeHealthSample = {
      ...node.health,
      ...patch,
      timestampMs: patch.timestampMs ?? nowMs(),
      batteryPct: patch.batteryPct ?? node.health.batteryPct,
      cpuPct: patch.cpuPct ?? node.health.cpuPct,
      memoryPct: patch.memoryPct ?? node.health.memoryPct,
      linkQuality: patch.linkQuality ?? node.health.linkQuality,
      gpsFix: patch.gpsFix ?? node.health.gpsFix,
      temperatureC: patch.temperatureC ?? node.health.temperatureC,
      missionId: patch.missionId ?? node.health.missionId,
      status: patch.status ?? deriveHealthStatus({ ...node.health, ...patch }),
    };
    node.health = merged;
    node.lastSeenMs = patch.timestampMs ?? nowMs();
    node.trustScore = this.trustFromHealth(node);
    node.reputationScore = this.reputationFromState(node);
    this.nodes.set(nodeId, node);
    this.history.push({ type: "health", tsMs: nowMs(), payload: { nodeId, health: node.health } });
    return node;
  }

  updateCapability(nodeId: NodeId, capabilityProfile: CapabilityProfile): NodeProfile | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    node.capabilityProfile = capabilityProfile;
    node.trustScore = this.trustFromHealth(node);
    node.reputationScore = this.reputationFromState(node);
    this.nodes.set(nodeId, node);
    this.history.push({ type: "capability", tsMs: nowMs(), payload: { nodeId, capabilityProfile } });
    return node;
  }

  addAttestation(attestation: PeerAttestation): void {
    this.attestations.push(attestation);
    const node = this.nodes.get(attestation.subjectNodeId);
    if (!node) return;
    if (attestation.accepted) {
      node.successfulTasks += 1;
      node.contributionCount += 1;
      node.rewardPoints += 2;
      node.trustScore = clamp(node.trustScore + 0.03, 0, 1);
      node.reputationScore = clamp(node.reputationScore + 0.05, 0, 1);
    } else {
      node.failedTasks += 1;
      node.trustScore = clamp(node.trustScore - 0.04, 0, 1);
      node.reputationScore = clamp(node.reputationScore - 0.06, 0, 1);
    }
    node.lastSeenMs = attestation.timestampMs;
    this.nodes.set(node.nodeId, node);
    this.history.push({ type: "attestation", tsMs: nowMs(), payload: { ...attestation } });
  }

  recentDiscoveries(limit = 100): NodeDiscoveryEvent[] {
    return this.discoveries.slice(-limit);
  }

  recentAttestations(limit = 100): PeerAttestation[] {
    return this.attestations.slice(-limit);
  }

  summary(): Record<string, unknown> {
    const nodes = this.all();
    return {
      total: nodes.length,
      active: this.active().length,
      stale: this.stale().length,
      avgTrust: nodes.length ? round2(nodes.reduce((a, b) => a + b.trustScore, 0) / nodes.length) : 0,
      avgReputation: nodes.length ? round2(nodes.reduce((a, b) => a + b.reputationScore, 0) / nodes.length) : 0,
      avgRewardPoints: nodes.length ? round2(nodes.reduce((a, b) => a + b.rewardPoints, 0) / nodes.length) : 0,
      discoveries: this.discoveries.length,
      attestations: this.attestations.length,
    };
  }

  private normalize(node: NodeProfile): NodeProfile {
    node.trustScore = clamp(node.trustScore, 0, 1);
    node.reputationScore = clamp(node.reputationScore, 0, 1);
    const h = {
      ...node.health,
      batteryPct: clamp(node.health.batteryPct, 0, 100),
      cpuPct: clamp(node.health.cpuPct, 0, 100),
      memoryPct: clamp(node.health.memoryPct, 0, 100),
      linkQuality: clamp(node.health.linkQuality, 0, 1),
    };
    node.health = {
      ...h,
      status: h.status && h.status !== HealthStatus.Unknown ? h.status : deriveHealthStatus(h),
    };
    return node;
  }

  private trustFromHealth(node: NodeProfile): number {
    const h = node.health;
    let score = 0.5;
    score += (h.batteryPct / 100) * 0.18;
    score += h.linkQuality * 0.2;
    score += h.gpsFix ? 0.05 : -0.05;
    score += h.cpuPct < 80 ? 0.03 : -0.03;
    score += h.memoryPct < 80 ? 0.03 : -0.03;
    if (h.temperatureC !== undefined && h.temperatureC > 75) score -= 0.08;
    if ((h.missionId ?? "") === "") score -= 0.02;
    if (h.status === HealthStatus.Degraded) score -= 0.04;
    if (h.status === HealthStatus.Unhealthy || h.status === HealthStatus.Offline) score -= 0.12;
    return clamp(score, 0, 1);
  }

  private reputationFromState(node: NodeProfile): number {
    const contributions = node.contributionCount;
    const denom = node.successfulTasks + node.failedTasks;
    const successRate = denom > 0 ? node.successfulTasks / denom : 0.5;
    const recentBonus = node.lastSeenMs > nowMs() - 5_000 ? 0.04 : 0;
    let score = 0.3 + successRate * 0.4 + clamp(contributions / 50, 0, 0.2) + recentBonus;
    score = clamp(score, 0, 1);
    return score;
  }
}

export class CapabilityScorer {
  private readonly scenarioPolicies = new Map<ScenarioKind, ScenarioPolicy>();

  constructor(policies?: ScenarioPolicy[]) {
    policies?.forEach((policy) => this.scenarioPolicies.set(policy.scenario, policy));
  }

  policyFor(scenario: ScenarioKind): ScenarioPolicy {
    const existing = this.scenarioPolicies.get(scenario);
    if (existing) return existing;
    const generated = scenarioDefaultPolicy(scenario);
    this.scenarioPolicies.set(scenario, generated);
    return generated;
  }

  score(node: NodeProfile, work: WorkItem): AssignmentCandidate {
    const policy = this.policyFor(work.scenario);
    const reasons: string[] = [];
    let score = 0;

    const capabilityHits = work.requiredCapabilities.filter((tag) => node.capabilityProfile.tags.includes(tag));
    const capabilityScore = work.requiredCapabilities.length > 0 ? capabilityHits.length / work.requiredCapabilities.length : 0.5;
    score += capabilityScore * 35;
    if (capabilityHits.length > 0) reasons.push(`capabilities:${capabilityHits.join(",")}`);

    const weightedCapabilityScore = Object.entries(policy.capabilityWeights).reduce((acc, [tag, weight]) => {
      if (node.capabilityProfile.tags.includes(tag as CapabilityTag)) return acc + (weight ?? 0);
      return acc;
    }, 0);
    score += weightedCapabilityScore * 2;
    if (weightedCapabilityScore > 0) reasons.push(`scenario_fit:${round2(weightedCapabilityScore)}`);

    const taskLower = work.taskType.toLowerCase();
    if (node.role === NodeRole.Relay && taskLower.includes("relay")) {
      score += 12;
      reasons.push("role_match:relay");
    }
    if (node.role === NodeRole.Triage && taskLower.includes("triage")) {
      score += 12;
      reasons.push("role_match:triage");
    }
    if (node.role === NodeRole.Rescuer && (taskLower.includes("rescue") || taskLower.includes("extract"))) {
      score += 12;
      reasons.push("role_match:rescuer");
    }
    if (node.role === NodeRole.Explorer && taskLower.includes("search")) {
      score += 10;
      reasons.push("role_match:explorer");
    }

    const trustComponent = node.trustScore * 100 * policy.trustWeight;
    const reputationComponent = node.reputationScore * 100 * 0.3;
    score += trustComponent + reputationComponent;
    reasons.push(`trust:${round2(node.trustScore)}`);
    reasons.push(`reputation:${round2(node.reputationScore)}`);

    const batteryComponent = (node.health.batteryPct / 100) * 100 * policy.batteryWeight;
    score += batteryComponent;
    reasons.push(`battery:${round2(node.health.batteryPct)}`);

    const linkComponent = clamp(node.health.linkQuality, 0, 1) * 100 * policy.linkWeight;
    score += linkComponent;
    reasons.push(`link:${round2(node.health.linkQuality)}`);

    const healthComponent = this.healthScore(node) * 100 * policy.healthWeight;
    score += healthComponent;
    reasons.push(`health:${round2(this.healthScore(node))}`);

    if (work.location && node.location) {
      const distance = euclideanDistance(work.location, node.location);
      const distancePenalty = work.maxDistanceM ? clamp(distance / work.maxDistanceM, 0, 1) : clamp(distance / 1000, 0, 1);
      score += (1 - distancePenalty) * 100 * policy.distanceWeight;
      reasons.push(`distance:${round2(distance)}`);
    }

    if (this.satisfiesScenarioBias(node, policy)) {
      score += 4;
      reasons.push("scenario_bias");
    }

    if (node.health.status === HealthStatus.Degraded) score -= 8;
    if (node.health.status === HealthStatus.Unhealthy || node.health.status === HealthStatus.Offline) score -= 40;

    if (node.health.batteryPct < work.minBatteryPct) score -= 50;
    if (node.trustScore < work.minTrustScore) score -= 25;

    const etaMs = this.estimateEta(node, work);
    return {
      nodeId: node.nodeId,
      score: round2(score),
      reasons,
      estimatedEtaMs: etaMs,
    };
  }

  rank(nodes: NodeProfile[], work: WorkItem): AssignmentCandidate[] {
    return nodes.map((n) => this.score(n, work)).sort((a, b) => b.score - a.score || a.estimatedEtaMs - b.estimatedEtaMs);
  }

  best(nodes: NodeProfile[], work: WorkItem): AssignmentCandidate | null {
    return this.rank(nodes, work)[0] ?? null;
  }

  isEligible(node: NodeProfile, work: WorkItem): boolean {
    if (node.trustScore < work.minTrustScore) return false;
    if (node.health.batteryPct < work.minBatteryPct) return false;
    if (node.health.status === HealthStatus.Offline || node.health.status === HealthStatus.Unhealthy) return false;
    return work.requiredCapabilities.every((cap) => node.capabilityProfile.tags.includes(cap));
  }

  private healthScore(node: NodeProfile): number {
    const h = node.health;
    let s = 0.5;
    s += (h.batteryPct / 100) * 0.25;
    s += h.linkQuality * 0.2;
    s += h.gpsFix ? 0.05 : -0.03;
    s += h.cpuPct < 85 ? 0.02 : -0.05;
    s += h.memoryPct < 85 ? 0.02 : -0.05;
    if (h.temperatureC !== undefined && h.temperatureC > 80) s -= 0.1;
    if (h.status === HealthStatus.Degraded) s -= 0.08;
    if (h.status === HealthStatus.Unhealthy || h.status === HealthStatus.Offline) s -= 0.25;
    return clamp(s, 0, 1);
  }

  private estimateEta(node: NodeProfile, work: WorkItem): number {
    if (!work.location || !node.location) return 2500;
    const distance = euclideanDistance(work.location, node.location);
    const speedEstimateMps = node.role === NodeRole.Relay ? 2.5 : node.role === NodeRole.Rescuer ? 3.0 : 2.0;
    return Math.round((distance / Math.max(0.1, speedEstimateMps)) * 1000);
  }

  private satisfiesScenarioBias(node: NodeProfile, policy: ScenarioPolicy): boolean {
    if (policy.indoorBias > policy.outdoorBias) {
      return node.capabilityProfile.indoorSuitability >= 0.7 || node.capabilityProfile.tags.includes(CapabilityTag.Indoor);
    }
    if (policy.outdoorBias > policy.indoorBias) {
      return node.capabilityProfile.outdoorSuitability >= 0.7 || node.capabilityProfile.tags.includes(CapabilityTag.Outdoor);
    }
    return true;
  }
}

export class TriangulatedValidator {
  private readonly proofs = new Map<ProofId, ValidationProof>();
  private readonly attestations: PeerAttestation[] = [];

  createProof(
    input: Omit<ValidationProof, "proofId" | "createdAtMs" | "accepted" | "reason" | "sourceHashes"> & {
      accepted?: boolean;
      reason?: string;
      evidenceHashes?: string[];
    },
  ): ValidationProof {
    const proof: ValidationProof = {
      ...input,
      proofId: id("proof"),
      createdAtMs: nowMs(),
      accepted: input.accepted ?? false,
      reason: input.reason ?? "",
      sourceHashes: input.evidenceHashes ?? [hashObject(input.evidence)],
    };
    this.proofs.set(proof.proofId, proof);
    return proof;
  }

  /** Register a proof produced elsewhere (same shape as ``ValidationProof``). */
  ingestProof(proof: ValidationProof): void {
    this.proofs.set(proof.proofId, { ...proof });
  }

  addAttestation(attestation: PeerAttestation): void {
    this.attestations.push(attestation);
  }

  evaluate(proofId: ProofId): ValidationProof | null {
    const proof = this.proofs.get(proofId);
    if (!proof) return null;
    const witnesses = new Set(proof.witnesses);
    const matching = this.attestations.filter((a) => a.subjectNodeId === proof.subjectNodeId && a.validationType === proof.validationType);
    const positive = matching.filter((a) => a.accepted && witnesses.has(a.witnessId));
    const negative = matching.filter((a) => !a.accepted && witnesses.has(a.witnessId));
    const quorumReached = positive.length >= Math.max(2, Math.ceil(witnesses.size / 2));
    proof.accepted = quorumReached && negative.length === 0;
    proof.reason = proof.accepted ? "quorum_accepted" : negative.length > 0 ? "negative_attestation" : "insufficient_quorum";
    this.proofs.set(proofId, proof);
    return proof;
  }

  acceptedProofs(limit = 100): ValidationProof[] {
    return [...this.proofs.values()]
      .filter((p) => p.accepted)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, limit);
  }

  recentProofs(limit = 100): ValidationProof[] {
    return [...this.proofs.values()].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, limit);
  }
}

export class ContributionTracker {
  private readonly contributions = new Map<EventId, ContributionEvent>();
  private readonly rewards = new Map<RewardId, RewardEvent>();
  private readonly rewardLedger: RewardLedgerEntry[] = [];

  addContribution(event: ContributionEvent): ContributionEvent {
    this.contributions.set(event.eventId, event);
    return event;
  }

  getContribution(eventId: EventId): ContributionEvent | undefined {
    return this.contributions.get(eventId);
  }

  recordReward(event: RewardEvent, updatedTrustScore: number, updatedReputationScore: number, balanceAfter: number): RewardLedgerEntry {
    this.rewards.set(event.rewardId, event);
    const ledgerEntry: RewardLedgerEntry = {
      reward: event,
      updatedTrustScore: clamp(updatedTrustScore, 0, 1),
      updatedReputationScore: clamp(updatedReputationScore, 0, 1),
      balanceAfter,
    };
    this.rewardLedger.push(ledgerEntry);
    return ledgerEntry;
  }

  forNode(nodeId: NodeId): ContributionEvent[] {
    return [...this.contributions.values()]
      .filter((c) => c.nodeId === nodeId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  rewardsForNode(nodeId: NodeId): RewardEvent[] {
    return [...this.rewards.values()]
      .filter((r) => r.nodeId === nodeId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  recentContributions(limit = 100): ContributionEvent[] {
    return [...this.contributions.values()].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, limit);
  }

  recentRewards(limit = 100): RewardEvent[] {
    return [...this.rewards.values()].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, limit);
  }

  balanceFor(nodeId: NodeId): number {
    return this.rewardsForNode(nodeId).reduce((acc, r) => acc + r.amount, 0);
  }

  ledger(): RewardLedgerEntry[] {
    return [...this.rewardLedger];
  }
}

export class RewardEngine {
  private readonly policyMultipliers: Map<RewardKind, number> = new Map();

  constructor(multipliers?: Partial<Record<RewardKind, number>>) {
    for (const kind of Object.values(RewardKind)) {
      this.policyMultipliers.set(kind, multipliers?.[kind as RewardKind] ?? 1.0);
    }
  }

  amountFor(contribution: ContributionEvent, proof?: ValidationProof | null): number {
    let amount = contribution.weight * 10;
    const multiplier = this.policyMultipliers.get(contribution.kind) ?? 1.0;
    amount *= multiplier;
    if (proof?.accepted) amount *= 1.15;
    if (contribution.kind === RewardKind.Rescue && proof?.validationType === ValidationType.Extraction) amount *= 1.2;
    if (contribution.kind === RewardKind.Relay && proof?.validationType === ValidationType.RelayContinuity) amount *= 1.3;
    if (contribution.kind === RewardKind.Validation && proof?.validationType) amount *= 1.1;
    return round2(Math.max(0, amount));
  }

  penaltyFor(contribution: ContributionEvent, reason: string): number {
    const base = Math.max(0, contribution.weight * 8);
    if (reason.includes("fraud") || reason.includes("invalid")) return round2(base * 1.5);
    return round2(base);
  }
}

export class LatticeNodeScorer {
  scoreCapabilities(node: NodeProfile, work: WorkItem, policy: ScenarioPolicy): number {
    let s = 0;
    for (const tag of work.requiredCapabilities) {
      if (node.capabilityProfile.tags.includes(tag)) s += policy.capabilityWeights[tag] ?? 1;
    }
    if (node.capabilityProfile.indoorSuitability >= 0.8 && policy.indoorBias > 0) s += policy.indoorBias;
    if (node.capabilityProfile.outdoorSuitability >= 0.8 && policy.outdoorBias > 0) s += policy.outdoorBias;
    if (node.capabilityProfile.maxRangeM >= (work.maxDistanceM ?? 0)) s += 0.5;
    if (node.capabilityProfile.maxAltitudeM >= 0) s += 0.1;
    return s;
  }

  scoreNode(node: NodeProfile, work: WorkItem, policy: ScenarioPolicy): AssignmentCandidate {
    const capabilityScore = this.scoreCapabilities(node, work, policy);
    const healthScore =
      node.health.status === HealthStatus.Healthy ? 1 : node.health.status === HealthStatus.Degraded ? 0.6 : 0.1;
    const trustScore = node.trustScore;
    const repScore = node.reputationScore;
    const distance = work.location && node.location ? euclideanDistance(work.location, node.location) : 0;
    const distanceScore = work.location && node.location ? Math.max(0, 1 - distance / Math.max(1, work.maxDistanceM ?? 500)) : 0.5;
    const batteryScore = node.health.batteryPct / 100;
    const linkScore = node.health.linkQuality;
    const score =
      capabilityScore * 20 +
      trustScore * 25 +
      repScore * 15 +
      healthScore * 20 +
      distanceScore * 10 +
      batteryScore * 5 +
      linkScore * 5;
    const reasons = [
      `capability:${round2(capabilityScore)}`,
      `trust:${round2(trustScore)}`,
      `reputation:${round2(repScore)}`,
      `health:${round2(healthScore)}`,
      `distance:${round2(distanceScore)}`,
      `battery:${round2(batteryScore)}`,
      `link:${round2(linkScore)}`,
    ];
    return { nodeId: node.nodeId, score: round2(score), reasons, estimatedEtaMs: Math.round((distance / 2) * 1000) };
  }
}

export class LatticeAssignmentPlanner {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly scorer = new LatticeNodeScorer(),
  ) {}

  rank(work: WorkItem): AssignmentCandidate[] {
    const policy = this.registry.policyFor(work.scenario);
    return this.registry
      .active()
      .filter((node) => this.eligible(node, work))
      .map((node) => this.scorer.scoreNode(node, work, policy))
      .sort((a, b) => b.score - a.score || a.estimatedEtaMs - b.estimatedEtaMs);
  }

  best(work: WorkItem): AssignmentCandidate | null {
    return this.rank(work)[0] ?? null;
  }

  eligible(node: NodeProfile, work: WorkItem): boolean {
    if (node.trustScore < work.minTrustScore) return false;
    if (node.health.batteryPct < work.minBatteryPct) return false;
    if (node.health.status === HealthStatus.Offline || node.health.status === HealthStatus.Unhealthy) return false;
    if (work.requiredCapabilities.some((cap) => !node.capabilityProfile.tags.includes(cap))) return false;
    if (work.maxDistanceM !== undefined && work.location && node.location) {
      if (euclideanDistance(work.location, node.location) > work.maxDistanceM) return false;
    }
    return true;
  }
}

export class LatticeRewardSystem {
  private readonly tracker = new ContributionTracker();
  private readonly rewardEngine: RewardEngine;
  private readonly validator: TriangulatedValidator;
  private readonly registry: NodeRegistry;
  private readonly planner: LatticeAssignmentPlanner;
  private readonly stateEvents: Array<{ tsMs: TimestampMs; type: string; payload: Record<string, unknown> }> = [];

  constructor(
    registry: NodeRegistry,
    opts?: { rewardMultipliers?: Partial<Record<RewardKind, number>>; validator?: TriangulatedValidator },
  ) {
    this.registry = registry;
    this.rewardEngine = new RewardEngine(opts?.rewardMultipliers);
    this.validator = opts?.validator ?? new TriangulatedValidator();
    this.planner = new LatticeAssignmentPlanner(registry);
  }

  registerNode(node: NodeProfile): NodeProfile {
    const registered = this.registry.register(node);
    this.stateEvents.push({ tsMs: nowMs(), type: "node_register", payload: { nodeId: node.nodeId, role: node.role } });
    return registered;
  }

  discoverNode(event: NodeDiscoveryEvent): NodeProfile {
    const node = this.registry.discovery(event);
    this.stateEvents.push({ tsMs: nowMs(), type: "node_discovery", payload: { ...event } });
    return node;
  }

  updateHealth(nodeId: NodeId, patch: Partial<Omit<NodeHealthSample, "status">> & { status?: HealthStatus }): NodeProfile | null {
    const node = this.registry.updateHealth(nodeId, patch);
    if (node) this.stateEvents.push({ tsMs: nowMs(), type: "health_update", payload: { nodeId, patch } });
    return node;
  }

  updateCapability(nodeId: NodeId, capabilityProfile: CapabilityProfile): NodeProfile | null {
    const node = this.registry.updateCapability(nodeId, capabilityProfile);
    if (node) this.stateEvents.push({ tsMs: nowMs(), type: "capability_update", payload: { nodeId, capabilityProfile } });
    return node;
  }

  validateContribution(attestation: PeerAttestation): void {
    this.registry.addAttestation(attestation);
    this.validator.addAttestation(attestation);
    this.stateEvents.push({ tsMs: nowMs(), type: "attestation", payload: { ...attestation } });
  }

  createProof(
    input: Omit<ValidationProof, "proofId" | "createdAtMs" | "accepted" | "reason" | "sourceHashes"> & {
      accepted?: boolean;
      reason?: string;
      evidenceHashes?: string[];
    },
  ): ValidationProof {
    const proof = this.validator.createProof(input);
    this.stateEvents.push({
      tsMs: nowMs(),
      type: "proof_create",
      payload: { proofId: proof.proofId, validationType: proof.validationType, subjectNodeId: proof.subjectNodeId },
    });
    return proof;
  }

  evaluateProof(proofId: ProofId): ValidationProof | null {
    const proof = this.validator.evaluate(proofId);
    if (proof) {
      this.stateEvents.push({ tsMs: nowMs(), type: "proof_evaluate", payload: { proofId, accepted: proof.accepted, reason: proof.reason } });
    }
    return proof;
  }

  allocate(work: WorkItem): AssignmentCandidate | null {
    const candidate = this.planner.best(work);
    this.stateEvents.push({ tsMs: nowMs(), type: "allocation", payload: { taskId: work.taskId, candidate } });
    return candidate;
  }

  allocateMany(workItems: WorkItem[]): Map<TaskId, AssignmentCandidate | null> {
    const out = new Map<TaskId, AssignmentCandidate | null>();
    for (const work of workItems) out.set(work.taskId, this.allocate(work));
    return out;
  }

  assignAndRecord(work: WorkItem): { assignment: AssignmentCandidate | null; updatedWork: WorkItem } {
    const assignment = this.allocate(work);
    const updatedWork: WorkItem = { ...work, assignedNodeId: assignment?.nodeId ?? null };
    this.stateEvents.push({
      tsMs: nowMs(),
      type: "assignment_record",
      payload: { taskId: work.taskId, assignedNodeId: updatedWork.assignedNodeId },
    });
    return { assignment, updatedWork };
  }

  recordContribution(event: ContributionEvent): ContributionEvent {
    const recorded = this.tracker.addContribution(event);
    this.stateEvents.push({ tsMs: nowMs(), type: "contribution", payload: { ...recorded } });
    return recorded;
  }

  settleContribution(eventId: EventId, proofId?: ProofId | null): RewardLedgerEntry | null {
    const contribution = this.tracker.getContribution(eventId) ?? this.tracker.recentContributions(1000).find((c) => c.eventId === eventId);
    if (!contribution) return null;
    const proof = proofId ? this.validator.recentProofs(1000).find((p) => p.proofId === proofId) ?? null : null;
    const amount = this.rewardEngine.amountFor(contribution, proof);
    const reward: RewardEvent = {
      rewardId: id("reward"),
      missionId: contribution.missionId,
      nodeId: contribution.nodeId,
      kind: contribution.kind,
      amount,
      reason: contribution.label,
      proofId: proof?.proofId ?? contribution.proofId ?? null,
      contributionEventId: contribution.eventId,
      createdAtMs: nowMs(),
      settled: true,
      metadata: {
        ...contribution.metadata,
        validationType: proof?.validationType,
        proofAccepted: proof?.accepted ?? false,
      },
    };
    const node = this.registry.get(contribution.nodeId);
    const updatedTrust = clamp((node?.trustScore ?? 0.5) + this.trustDeltaFor(contribution, proof), 0, 1);
    const updatedReputation = clamp((node?.reputationScore ?? 0.5) + this.reputationDeltaFor(contribution, proof), 0, 1);
    const balanceAfter = this.tracker.balanceFor(contribution.nodeId) + amount;
    const ledger = this.tracker.recordReward(reward, updatedTrust, updatedReputation, balanceAfter);
    if (node) {
      node.rewardPoints += amount;
      node.trustScore = updatedTrust;
      node.reputationScore = updatedReputation;
      node.contributionCount += 1;
      if (amount > 0) node.successfulTasks += 1;
      node.lastSeenMs = nowMs();
      this.registry.register(node);
    }
    this.stateEvents.push({
      tsMs: nowMs(),
      type: "reward_settle",
      payload: { rewardId: reward.rewardId, nodeId: reward.nodeId, amount: reward.amount, proofId },
    });
    return ledger;
  }

  settleContributions(contributionEvents: Array<{ eventId: EventId; proofId?: ProofId | null }>): RewardLedgerEntry[] {
    const ledgers: RewardLedgerEntry[] = [];
    for (const item of contributionEvents) {
      const ledger = this.settleContribution(item.eventId, item.proofId ?? null);
      if (ledger) ledgers.push(ledger);
    }
    return ledgers;
  }

  applyPenalty(nodeId: NodeId, reason: string, amount = 5): RewardEvent | null {
    const node = this.registry.get(nodeId);
    if (!node) return null;
    const reward: RewardEvent = {
      rewardId: id("penalty"),
      missionId: node.missionId ?? "",
      nodeId,
      kind: RewardKind.Penalty,
      amount: -Math.abs(amount),
      reason,
      settled: true,
      createdAtMs: nowMs(),
      metadata: { reason },
    };
    const updatedTrust = clamp(node.trustScore - 0.05, 0, 1);
    const updatedReputation = clamp(node.reputationScore - 0.08, 0, 1);
    this.tracker.recordReward(reward, updatedTrust, updatedReputation, this.tracker.balanceFor(nodeId) - Math.abs(amount));
    node.trustScore = updatedTrust;
    node.reputationScore = updatedReputation;
    node.failedTasks += 1;
    node.lastSeenMs = nowMs();
    this.registry.register(node);
    this.stateEvents.push({ tsMs: nowMs(), type: "penalty", payload: { nodeId, reason, amount } });
    return reward;
  }

  rewardForValidation(nodeId: NodeId, proof: ValidationProof): RewardLedgerEntry | null {
    const contribution: ContributionEvent = {
      eventId: id("contrib"),
      missionId: proof.missionId,
      nodeId,
      kind: RewardKind.Validation,
      label: `validation:${proof.validationType}`,
      proofId: proof.proofId,
      weight: proof.accepted ? 1.2 : 0.5,
      createdAtMs: nowMs(),
      metadata: { proofId: proof.proofId, validationType: proof.validationType, accepted: proof.accepted },
    };
    this.recordContribution(contribution);
    return this.settleContribution(contribution.eventId, proof.proofId);
  }

  rewardForRelayContinuity(missionId: MissionId, nodeId: NodeId, proof: ValidationProof): RewardLedgerEntry | null {
    const contribution: ContributionEvent = {
      eventId: id("relay"),
      missionId,
      nodeId,
      kind: RewardKind.Relay,
      label: "relay_continuity",
      proofId: proof.proofId,
      weight: proof.accepted ? 1.5 : 0.4,
      createdAtMs: nowMs(),
      metadata: { proofId: proof.proofId, validationType: proof.validationType },
    };
    this.recordContribution(contribution);
    return this.settleContribution(contribution.eventId, proof.proofId);
  }

  rewardForDiscovery(missionId: MissionId, nodeId: NodeId, cellsDiscovered: number, proof?: ValidationProof | null): RewardLedgerEntry | null {
    const contribution: ContributionEvent = {
      eventId: id("discover"),
      missionId,
      nodeId,
      kind: RewardKind.Discovery,
      label: "map_discovery",
      proofId: proof?.proofId ?? null,
      weight: Math.max(0.2, cellsDiscovered / 10),
      createdAtMs: nowMs(),
      metadata: { cellsDiscovered, proofId: proof?.proofId ?? null },
    };
    this.recordContribution(contribution);
    return this.settleContribution(contribution.eventId, proof?.proofId ?? null);
  }

  rewardForRescue(missionId: MissionId, nodeId: NodeId, targetId: TargetId, proof: ValidationProof): RewardLedgerEntry | null {
    const contribution: ContributionEvent = {
      eventId: id("rescue"),
      missionId,
      nodeId,
      kind: RewardKind.Rescue,
      label: "victim_extraction",
      proofId: proof.proofId,
      targetId,
      weight: proof.accepted ? 2.0 : 0.6,
      createdAtMs: nowMs(),
      metadata: { targetId, proofId: proof.proofId },
    };
    this.recordContribution(contribution);
    return this.settleContribution(contribution.eventId, proof.proofId);
  }

  rewardForRecovery(missionId: MissionId, nodeId: NodeId, reason: string, proof?: ValidationProof | null): RewardLedgerEntry | null {
    const contribution: ContributionEvent = {
      eventId: id("recovery"),
      missionId,
      nodeId,
      kind: RewardKind.Recovery,
      label: reason,
      proofId: proof?.proofId ?? null,
      weight: 1.0,
      createdAtMs: nowMs(),
      metadata: { reason, proofId: proof?.proofId ?? null },
    };
    this.recordContribution(contribution);
    return this.settleContribution(contribution.eventId, proof?.proofId ?? null);
  }

  rewardForSafetyResponse(missionId: MissionId, nodeId: NodeId, reason: string, proof?: ValidationProof | null): RewardLedgerEntry | null {
    const contribution: ContributionEvent = {
      eventId: id("safety"),
      missionId,
      nodeId,
      kind: RewardKind.Safety,
      label: reason,
      proofId: proof?.proofId ?? null,
      weight: 0.8,
      createdAtMs: nowMs(),
      metadata: { reason, proofId: proof?.proofId ?? null },
    };
    this.recordContribution(contribution);
    return this.settleContribution(contribution.eventId, proof?.proofId ?? null);
  }

  getRewardBalance(nodeId: NodeId): number {
    return this.tracker.balanceFor(nodeId);
  }

  balances(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const node of this.registry.all()) out[node.nodeId] = this.tracker.balanceFor(node.nodeId);
    return out;
  }

  contributionHistory(nodeId?: NodeId): ContributionEvent[] {
    return nodeId ? this.tracker.forNode(nodeId) : this.tracker.recentContributions(10_000);
  }

  rewards(nodeId?: NodeId): RewardEvent[] {
    return nodeId ? this.tracker.rewardsForNode(nodeId) : this.tracker.recentRewards(10_000);
  }

  recentLedger(): RewardLedgerEntry[] {
    return this.tracker.ledger();
  }

  recentEvents(limit = 100): Array<{ tsMs: TimestampMs; type: string; payload: Record<string, unknown> }> {
    return this.stateEvents.slice(-limit);
  }

  healthSummary(): LatticeHealthSummary {
    const nodes = this.registry.all();
    const healthyCount = nodes.filter((n) => n.health.status === HealthStatus.Healthy).length;
    const degradedCount = nodes.filter((n) => n.health.status === HealthStatus.Degraded).length;
    const offlineCount = nodes.filter((n) => n.health.status === HealthStatus.Offline || n.health.status === HealthStatus.Unhealthy).length;
    return {
      nodeCount: nodes.length,
      healthyCount,
      degradedCount,
      offlineCount,
      averageTrustScore: nodes.length ? round2(nodes.reduce((a, b) => a + b.trustScore, 0) / nodes.length) : 0,
      averageReputationScore: nodes.length ? round2(nodes.reduce((a, b) => a + b.reputationScore, 0) / nodes.length) : 0,
      totalRewardPoints: round2(nodes.reduce((a, b) => a + b.rewardPoints, 0)),
      recentProofCount: this.validator.recentProofs(100).length,
      recentContributionCount: this.tracker.recentContributions(100).length,
    };
  }

  buildRewardManifest(missionId: MissionId): Record<string, unknown> {
    const contributions = this.contributionHistory().filter((c) => c.missionId === missionId);
    const rewards = this.rewards().filter((r) => r.missionId === missionId);
    const proofs = this.validator.recentProofs(10_000).filter((p) => p.missionId === missionId);
    return {
      missionId,
      createdAtMs: nowMs(),
      contributions,
      rewards,
      proofs,
      balances: this.balances(),
      ledgerHash: hashObject({ contributions, rewards, proofs }),
    };
  }

  buildSettlementPayload(missionId: MissionId): Record<string, unknown> {
    const manifest = this.buildRewardManifest(missionId);
    return {
      missionId,
      manifest,
      outcomeHash: hashObject(manifest),
      settlementReady: true,
      tsMs: nowMs(),
    };
  }

  rankNodesForTask(work: WorkItem): AssignmentCandidate[] {
    return this.planner.rank(work);
  }

  bestNodeForTask(work: WorkItem): AssignmentCandidate | null {
    return this.planner.best(work);
  }

  policyFor(scenario: ScenarioKind): ScenarioPolicy {
    return this.registry.policyFor(scenario);
  }

  scenarioFit(nodeId: NodeId, scenario: ScenarioKind): Record<string, unknown> {
    const node = this.registry.get(nodeId);
    if (!node) return { nodeId, scenario, fit: 0, reason: "unknown_node" };
    const policy = this.policyFor(scenario);
    const capabilityHits = node.capabilityProfile.tags.filter((tag) => policy.capabilityWeights[tag] !== undefined);
    const fit = capabilityHits.reduce((acc, tag) => acc + (policy.capabilityWeights[tag] ?? 0), 0);
    return {
      nodeId,
      scenario,
      fit: round2(fit + node.trustScore + node.reputationScore),
      capabilityHits,
      hazardClearance: node.capabilityProfile.hazardClearance,
      indoorSuitability: node.capabilityProfile.indoorSuitability,
      outdoorSuitability: node.capabilityProfile.outdoorSuitability,
      trustScore: node.trustScore,
      reputationScore: node.reputationScore,
    };
  }

  private trustDeltaFor(contribution: ContributionEvent, proof?: ValidationProof | null): number {
    let delta = 0.01;
    if (proof?.accepted) delta += 0.04;
    if (contribution.kind === RewardKind.Relay) delta += 0.03;
    if (contribution.kind === RewardKind.Rescue) delta += 0.05;
    if (contribution.kind === RewardKind.Safety) delta += 0.04;
    return delta;
  }

  private reputationDeltaFor(contribution: ContributionEvent, proof?: ValidationProof | null): number {
    let delta = 0.02;
    if (proof?.accepted) delta += 0.05;
    if (contribution.kind === RewardKind.Discovery) delta += 0.03;
    if (contribution.kind === RewardKind.Validation) delta += 0.04;
    if (contribution.kind === RewardKind.Recovery) delta += 0.03;
    if (contribution.kind === RewardKind.Penalty) delta -= 0.1;
    return delta;
  }
}

export class LatticeRewardCoordinator {
  private readonly system: LatticeRewardSystem;

  constructor(system: LatticeRewardSystem) {
    this.system = system;
  }

  onNodeDiscovery(event: NodeDiscoveryEvent, profile: Partial<NodeProfile>): NodeProfile {
    const t = nowMs();
    const node: NodeProfile = {
      nodeId: event.nodeId,
      displayName: profile.displayName ?? event.nodeId,
      role: profile.role ?? NodeRole.Standby,
      endpoint: event.endpoint ?? profile.endpoint ?? null,
      publicKey: profile.publicKey ?? "",
      vendor: profile.vendor,
      model: profile.model,
      location: event.location ?? profile.location ?? null,
      capabilityProfile: profile.capabilityProfile ?? {
        tags: [],
        sensorStack: [],
        maxRangeM: 0,
        maxAltitudeM: 0,
        indoorSuitability: 0.5,
        outdoorSuitability: 0.5,
        hazardClearance: [],
      },
      health: profile.health ?? {
        timestampMs: t,
        batteryPct: 100,
        cpuPct: 0,
        memoryPct: 0,
        linkQuality: 1,
        gpsFix: true,
        status: HealthStatus.Healthy,
      },
      trustScore: profile.trustScore ?? 0.5,
      reputationScore: profile.reputationScore ?? 0.5,
      rewardPoints: profile.rewardPoints ?? 0,
      contributionCount: profile.contributionCount ?? 0,
      successfulTasks: profile.successfulTasks ?? 0,
      failedTasks: profile.failedTasks ?? 0,
      lastSeenMs: event.seenAtMs,
      firstSeenMs: profile.firstSeenMs ?? event.seenAtMs,
      missionId: event.missionId ?? profile.missionId ?? null,
      metadata: { ...(profile.metadata ?? {}), ...(event.metadata ?? {}) },
    };
    return this.system.registerNode(node);
  }

  updateNodeHealth(nodeId: NodeId, patch: Partial<Omit<NodeHealthSample, "status">> & { status?: HealthStatus }): NodeProfile | null {
    return this.system.updateHealth(nodeId, patch);
  }

  updateNodeCapability(nodeId: NodeId, capabilityProfile: CapabilityProfile): NodeProfile | null {
    return this.system.updateCapability(nodeId, capabilityProfile);
  }

  addAttestation(attestation: PeerAttestation): void {
    this.system.validateContribution(attestation);
  }

  scoreWork(work: WorkItem): AssignmentCandidate[] {
    return this.system.rankNodesForTask(work);
  }

  selectNode(work: WorkItem): AssignmentCandidate | null {
    return this.system.bestNodeForTask(work);
  }

  /** Re-evaluate quorum for an existing proof (must exist on the system's validator, or call ``ingestProof`` first). */
  recordProof(proof: ValidationProof): ValidationProof {
    return this.system.evaluateProof(proof.proofId) ?? proof;
  }

  settleWork(eventId: EventId, proofId?: ProofId | null): RewardLedgerEntry | null {
    return this.system.settleContribution(eventId, proofId);
  }

  rewardDiscovery(missionId: MissionId, nodeId: NodeId, cellsDiscovered: number, proof?: ValidationProof | null): RewardLedgerEntry | null {
    return this.system.rewardForDiscovery(missionId, nodeId, cellsDiscovered, proof ?? null);
  }

  rewardRelay(missionId: MissionId, nodeId: NodeId, proof: ValidationProof): RewardLedgerEntry | null {
    return this.system.rewardForRelayContinuity(missionId, nodeId, proof);
  }

  rewardRescue(missionId: MissionId, nodeId: NodeId, targetId: TargetId, proof: ValidationProof): RewardLedgerEntry | null {
    return this.system.rewardForRescue(missionId, nodeId, targetId, proof);
  }

  rewardRecovery(missionId: MissionId, nodeId: NodeId, reason: string, proof?: ValidationProof | null): RewardLedgerEntry | null {
    return this.system.rewardForRecovery(missionId, nodeId, reason, proof ?? null);
  }

  rewardSafety(missionId: MissionId, nodeId: NodeId, reason: string, proof?: ValidationProof | null): RewardLedgerEntry | null {
    return this.system.rewardForSafetyResponse(missionId, nodeId, reason, proof ?? null);
  }

  applyPenalty(nodeId: NodeId, reason: string, amount = 5): RewardEvent | null {
    return this.system.applyPenalty(nodeId, reason, amount);
  }

  manifest(missionId: MissionId): Record<string, unknown> {
    return this.system.buildRewardManifest(missionId);
  }

  settlementPayload(missionId: MissionId): Record<string, unknown> {
    return this.system.buildSettlementPayload(missionId);
  }

  nodeSummary(nodeId: NodeId): Record<string, unknown> {
    return {
      nodeId,
      balance: this.system.getRewardBalance(nodeId),
      scenarioFit: [
        ScenarioKind.CollapsedBuilding,
        ScenarioKind.CaveTunnel,
        ScenarioKind.Flood,
        ScenarioKind.Wildfire,
        ScenarioKind.Industrial,
        ScenarioKind.Forest,
        ScenarioKind.Night,
        ScenarioKind.Indoor,
        ScenarioKind.Perimeter,
        ScenarioKind.Triage,
      ].map((scenario) => this.system.scenarioFit(nodeId, scenario)),
      contributions: this.system.contributionHistory(nodeId),
      rewards: this.system.rewards(nodeId),
    };
  }
}

export function buildDemoNodeProfile(
  nodeId: NodeId,
  role: NodeRole,
  tags: CapabilityTag[],
  health?: Partial<Omit<NodeHealthSample, "status">> & { status?: HealthStatus },
  location?: XYPoint,
): NodeProfile {
  const t = nowMs();
  const h: NodeHealthSample = {
    timestampMs: t,
    batteryPct: health?.batteryPct ?? 100,
    cpuPct: health?.cpuPct ?? 10,
    memoryPct: health?.memoryPct ?? 10,
    linkQuality: health?.linkQuality ?? 1,
    gpsFix: health?.gpsFix ?? true,
    temperatureC: health?.temperatureC,
    missionId: health?.missionId ?? null,
    status: health?.status ?? deriveHealthStatus({
      batteryPct: health?.batteryPct ?? 100,
      linkQuality: health?.linkQuality ?? 1,
      cpuPct: health?.cpuPct ?? 10,
      memoryPct: health?.memoryPct ?? 10,
    }),
  };
  return {
    nodeId,
    displayName: nodeId,
    role,
    endpoint: { host: "127.0.0.1", port: 1883, scheme: "mqtt" },
    publicKey: `pub-${nodeId}`,
    vendor: "demo",
    model: "generic",
    location: location ?? null,
    capabilityProfile: {
      tags,
      sensorStack: tags.map((tag) => String(tag)),
      maxRangeM: 500,
      maxAltitudeM: 120,
      indoorSuitability: tags.includes(CapabilityTag.Indoor) ? 0.95 : 0.3,
      outdoorSuitability: tags.includes(CapabilityTag.Outdoor) ? 0.95 : 0.5,
      hazardClearance: tags.map((tag) => String(tag)),
      notes: {},
    },
    health: h,
    trustScore: 0.7,
    reputationScore: 0.65,
    rewardPoints: 0,
    contributionCount: 0,
    successfulTasks: 0,
    failedTasks: 0,
    lastSeenMs: t,
    firstSeenMs: t,
    missionId: health?.missionId ?? null,
    metadata: {},
  };
}

export function buildDemoWorkItem(
  missionId: MissionId,
  scenario: ScenarioKind,
  taskId: TaskId,
  taskType: string,
  requiredCapabilities: CapabilityTag[],
  location?: XYPoint,
): WorkItem {
  const t = nowMs();
  return {
    taskId,
    missionId,
    scenario,
    taskType,
    requirements: { scenario, taskType },
    priority: 5,
    location: location ?? null,
    requiredCapabilities,
    minTrustScore: 0.45,
    minBatteryPct: 35,
    maxDistanceM: 750,
    rescueTargetId: null,
    createdAtMs: t,
    expiresAtMs: t + 60_000,
    metadata: {},
  };
}

export function latticeSmokeDemo(): Record<string, unknown> {
  const registry = new NodeRegistry();
  const lattice = new LatticeRewardSystem(registry);
  const coordinator = new LatticeRewardCoordinator(lattice);

  const nodeA = buildDemoNodeProfile(
    "drone-a",
    NodeRole.Explorer,
    [CapabilityTag.Camera, CapabilityTag.GPS, CapabilityTag.IMU, CapabilityTag.Outdoor, CapabilityTag.LongRange],
    { batteryPct: 88, linkQuality: 0.96, gpsFix: true },
    { x: 10, y: 10, z: 2 },
  );
  const nodeB = buildDemoNodeProfile(
    "drone-b",
    NodeRole.Relay,
    [CapabilityTag.Relay, CapabilityTag.LongRange, CapabilityTag.Indoor, CapabilityTag.Compact, CapabilityTag.Camera],
    { batteryPct: 91, linkQuality: 0.98, gpsFix: true },
    { x: 14, y: 7, z: 1 },
  );
  const nodeC = buildDemoNodeProfile(
    "drone-c",
    NodeRole.Rescuer,
    [CapabilityTag.Camera, CapabilityTag.Gripper, CapabilityTag.Payload, CapabilityTag.Indoor],
    { batteryPct: 79, linkQuality: 0.9, gpsFix: true },
    { x: 18, y: 11, z: 1 },
  );
  coordinator.onNodeDiscovery(
    { nodeId: nodeA.nodeId, discoveredBy: "command-1", missionId: "mission-1", seenAtMs: nowMs(), endpoint: nodeA.endpoint ?? undefined, location: nodeA.location ?? undefined },
    {},
  );
  coordinator.onNodeDiscovery(
    { nodeId: nodeB.nodeId, discoveredBy: "command-1", missionId: "mission-1", seenAtMs: nowMs(), endpoint: nodeB.endpoint ?? undefined, location: nodeB.location ?? undefined },
    {},
  );
  coordinator.onNodeDiscovery(
    { nodeId: nodeC.nodeId, discoveredBy: "command-1", missionId: "mission-1", seenAtMs: nowMs(), endpoint: nodeC.endpoint ?? undefined, location: nodeC.location ?? undefined },
    {},
  );
  coordinator.updateNodeCapability(nodeA.nodeId, nodeA.capabilityProfile);
  coordinator.updateNodeCapability(nodeB.nodeId, nodeB.capabilityProfile);
  coordinator.updateNodeCapability(nodeC.nodeId, nodeC.capabilityProfile);
  coordinator.updateNodeHealth(nodeA.nodeId, { batteryPct: 87, cpuPct: 22, memoryPct: 20, linkQuality: 0.95, gpsFix: true, missionId: "mission-1" });
  coordinator.updateNodeHealth(nodeB.nodeId, { batteryPct: 91, cpuPct: 18, memoryPct: 17, linkQuality: 0.98, gpsFix: true, missionId: "mission-1" });
  coordinator.updateNodeHealth(nodeC.nodeId, { batteryPct: 78, cpuPct: 30, memoryPct: 19, linkQuality: 0.91, gpsFix: true, missionId: "mission-1" });

  const missionId = "mission-1";
  const work = buildDemoWorkItem(missionId, ScenarioKind.CollapsedBuilding, "task-search-1", "search_cell", [CapabilityTag.Indoor, CapabilityTag.Camera, CapabilityTag.IMU], {
    x: 16,
    y: 9,
    z: 0,
  });
  const candidate = coordinator.selectNode(work);
  const proof = coordinator.recordProof(
    lattice.createProof({
      validationType: ValidationType.TaskCompletion,
      missionId,
      taskId: work.taskId,
      subjectNodeId: candidate?.nodeId ?? nodeA.nodeId,
      witnesses: [nodeA.nodeId, nodeB.nodeId, nodeC.nodeId],
      evidence: { cellCount: 12, scanHash: hashObject(work), candidate },
      accepted: true,
      reason: "task_completion_quorum",
      evidenceHashes: [hashObject(work), hashObject(candidate ?? {})],
    }),
  );
  lattice.validateContribution({
    witnessId: nodeB.nodeId,
    subjectNodeId: candidate?.nodeId ?? nodeA.nodeId,
    validationType: ValidationType.TaskCompletion,
    accepted: true,
    reason: "peer_confirmed",
    timestampMs: nowMs(),
    evidenceHash: hashObject(work),
  });
  const rewardEntry = candidate ? coordinator.rewardDiscovery(missionId, candidate.nodeId, 9, proof) : null;
  const relayProof = lattice.createProof({
    validationType: ValidationType.RelayContinuity,
    missionId,
    subjectNodeId: nodeB.nodeId,
    witnesses: [nodeA.nodeId, nodeC.nodeId],
    evidence: { hops: 4, continuityMs: 11_250 },
    accepted: true,
    reason: "relay_continuity_validated",
  });
  const relayReward = coordinator.rewardRelay(missionId, nodeB.nodeId, relayProof);
  const rescueProof = lattice.createProof({
    validationType: ValidationType.Extraction,
    missionId,
    taskId: "task-extract-1",
    targetId: "victim-1",
    subjectNodeId: nodeC.nodeId,
    witnesses: [nodeA.nodeId, nodeB.nodeId],
    evidence: { extractionVerified: true, targetId: "victim-1" },
    accepted: true,
    reason: "victim_extraction_validated",
  });
  const rescueReward = coordinator.rewardRescue(missionId, nodeC.nodeId, "victim-1", rescueProof);
  const settlement = coordinator.settlementPayload(missionId);
  return {
    nodes: registry.summary(),
    candidate,
    proof,
    rewardEntry,
    relayReward,
    rescueReward,
    balances: lattice.balances(),
    health: lattice.healthSummary(),
    manifest: coordinator.manifest(missionId),
    settlement,
    scenarioFit: coordinator.nodeSummary(nodeC.nodeId),
    recentLedger: lattice.recentLedger(),
    recentEvents: lattice.recentEvents(50),
  };
}
