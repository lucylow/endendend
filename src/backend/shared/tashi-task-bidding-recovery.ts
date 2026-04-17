/**
 * Task bidding, authoritative commit, and proof-producing recovery checkpoints
 * for Tashi SAR backend.
 *
 * - Nodes publish bids with capability, ETA, battery reserve, confidence, and proof hints.
 * - Lattice scores bids using validated capacity and mission policy.
 * - Vertex orders the final assignment so there is one authoritative winner.
 * - Arc can later settle the assignment outcome if a public artifact is needed.
 *
 * Recovery checkpoints carry mission ID, phase, consensus sequence, map version,
 * active nodes, target registry, and the last ledger hash. The backend can load
 * the latest checkpoint, replay the tail of the event ledger, rehydrate mission
 * state, and emit sync hints for peers.
 *
 * Backend-only; intended to compose with ``tashi-mission-map-machine`` (map /
 * phase) and Lattice / Vertex adapters.
 */

import { createHash, randomUUID } from "node:crypto";

import type { MissionPhase } from "./mission-phases";
import type {
  MapSnapshot,
  MissionId,
  NodeId,
  TargetId,
  EventId,
  TimestampMs,
  Version,
  XYPoint,
  TargetRecord,
  MissionObjectives,
} from "./tashi-mission-map-machine";
import { NodeRole } from "./tashi-mission-map-machine";

export type TaskId = string;
export type CheckpointId = string;
export type ProofId = string;

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

export enum TaskBidStatus {
  Open = "open",
  Submitted = "submitted",
  Weighted = "weighted",
  Committed = "committed",
  Rejected = "rejected",
  Expired = "expired",
  Cancelled = "cancelled",
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

export interface NodeHealthSample {
  timestampMs: TimestampMs;
  batteryPct: number;
  cpuPct: number;
  memoryPct: number;
  linkQuality: number;
  gpsFix: boolean;
  temperatureC?: number;
  missionId?: MissionId | null;
}

export interface CapabilityProfile {
  tags: string[];
  sensorStack: string[];
  maxRangeM: number;
  maxAltitudeM: number;
  indoorSuitability: number;
  outdoorSuitability: number;
  hazardClearance: string[];
  notes?: Record<string, unknown>;
}

export interface NodeProfile {
  nodeId: NodeId;
  displayName: string;
  role: NodeRole;
  publicKey: string;
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
  location?: XYPoint | null;
  missionId?: MissionId | null;
  metadata: Record<string, unknown>;
}

/** Rich mission read model for bidding / settlement (distinct from ``MissionSnapshot`` on the state machine). */
export interface BiddingMissionSnapshot {
  missionId: MissionId;
  phase: MissionPhase;
  phaseVersion: Version;
  updatedAtMs: TimestampMs;
  nodes: Record<NodeId, NodeProfile>;
  targets: Record<TargetId, TargetRecord>;
  map: { mapId: string; version: Version; coveragePct: number; dirtyCount: number };
  objectives: MissionObjectives;
  consensusSequence: number;
  lastLedgerHash: string;
  metadata: Record<string, unknown>;
}

export interface TaskWorkItem {
  taskId: TaskId;
  missionId: MissionId;
  scenario: ScenarioKind;
  taskType: string;
  priority: number;
  location?: XYPoint | null;
  requiredCapabilities: string[];
  minTrustScore: number;
  minBatteryPct: number;
  maxDistanceM?: number;
  rescueTargetId?: TargetId | null;
  createdAtMs: TimestampMs;
  expiresAtMs: TimestampMs;
  metadata: Record<string, unknown>;
}

export interface TaskBid {
  bidId: EventId;
  taskId: TaskId;
  missionId: MissionId;
  nodeId: NodeId;
  role: NodeRole;
  scenario: ScenarioKind;
  capabilityScore: number;
  trustScore: number;
  reputationScore: number;
  batteryPct: number;
  linkQuality: number;
  etaMs: number;
  confidence: number;
  distanceM: number;
  resources: Record<string, unknown>;
  proofHints: Record<string, unknown>;
  createdAtMs: TimestampMs;
  expiresAtMs: TimestampMs;
  status: TaskBidStatus;
  metadata: Record<string, unknown>;
}

export interface BidScoreBreakdown {
  total: number;
  capability: number;
  trust: number;
  reputation: number;
  battery: number;
  linkQuality: number;
  distance: number;
  eta: number;
  confidence: number;
  roleFit: number;
  scenarioFit: number;
  penalties: number;
  reasons: string[];
}

export interface WeightedBid extends TaskBid {
  score: BidScoreBreakdown;
}

export interface BidWindow {
  taskId: TaskId;
  missionId: MissionId;
  openedAtMs: TimestampMs;
  closesAtMs: TimestampMs;
  closedAtMs?: TimestampMs | null;
  status: "open" | "closed" | "committed" | "cancelled" | "expired";
  minBids: number;
  requiredQuorum: number;
  acceptedWinnerId?: NodeId | null;
  winningBidId?: EventId | null;
  metadata: Record<string, unknown>;
}

export interface BidCommitRecord {
  commitId: EventId;
  missionId: MissionId;
  taskId: TaskId;
  phase: "bidding" | "committed" | "aborted";
  winnerNodeId?: NodeId | null;
  winningBidId?: EventId | null;
  bidsSeen: number;
  consensusSequence: number;
  committedAtMs: TimestampMs;
  proofHash: string;
  metadata: Record<string, unknown>;
}

export interface VertexCommitAdapter {
  submitOrderedAssignment(
    record: BidCommitRecord,
  ): Promise<{ ok: boolean; sequence: number; proofHash: string }> | { ok: boolean; sequence: number; proofHash: string };
  submitCheckpoint?(
    record: RecoveryCheckpoint,
  ): Promise<{ ok: boolean; sequence: number; proofHash: string }> | { ok: boolean; sequence: number; proofHash: string };
}

export interface LatticeValidationAdapter {
  rankCandidates(task: TaskWorkItem, nodes: NodeProfile[]): WeightedBid[];
  validateBid(bid: TaskBid, node: NodeProfile, task: TaskWorkItem): { accepted: boolean; reasons: string[]; score: BidScoreBreakdown };
  getNode(nodeId: NodeId): NodeProfile | null;
  activeNodes(): NodeProfile[];
}

export interface RewardAdapter {
  recordWork?(payload: {
    missionId: MissionId;
    nodeId: NodeId;
    kind: RewardKind;
    amount: number;
    reason: string;
    proofId?: ProofId | null;
    metadata?: Record<string, unknown>;
  }): void;
}

export interface LedgerEvent {
  eventId: EventId;
  missionId: MissionId;
  kind: string;
  actorId: NodeId;
  payload: Record<string, unknown>;
  previousHash: string;
  timestampMs: TimestampMs;
  signature: string;
  nonce: string;
  blockIndex: number;
  cumulativeHash: string;
}

export interface RecoveryCheckpoint {
  checkpointId: CheckpointId;
  missionId: MissionId;
  phase: MissionPhase;
  phaseVersion: Version;
  consensusSequence: number;
  mapVersion: Version;
  mapHash: string;
  activeNodeIds: NodeId[];
  targetRegistry: Record<TargetId, TargetRecord>;
  nodeSummary: Record<
    NodeId,
    {
      role: NodeRole;
      batteryPct: number;
      linkQuality: number;
      trustScore: number;
      reputationScore: number;
      lastSeenMs?: TimestampMs;
    }
  >;
  lastLedgerHash: string;
  previousCheckpointHash: string;
  createdAtMs: TimestampMs;
  createdBy: NodeId;
  reason: string;
  metadata: Record<string, unknown>;
  proofHash: string;
}

export interface CheckpointVerification {
  ok: boolean;
  reason: string;
  missingFields: string[];
  staleNodes: NodeId[];
  /** True when checkpoint map version does not match the supplied current map version. */
  versionMismatch: boolean;
  /** True when checkpoint sealed hash does not match the supplied ledger head hash. */
  ledgerMismatch: boolean;
  /** Recomputed proof hash matches stored ``proofHash``. */
  integrityOk: boolean;
}

export interface RecoveryPlan {
  missionId: MissionId;
  restoreCheckpoint: RecoveryCheckpoint | null;
  replayEvents: LedgerEvent[];
  syncNeededFromPeers: NodeId[];
  trustRevalidationNeeded: NodeId[];
  mapSyncNeeded: boolean;
  taskSyncNeeded: boolean;
  recommendations: string[];
}

export interface RecoverySyncHint {
  peerId: NodeId;
  needsMap: boolean;
  needsTasks: boolean;
  reason: string;
}

function nowMs(): TimestampMs {
  return Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type Jsonable = null | boolean | number | string | Jsonable[] | { [k: string]: Jsonable };

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const helper = (input: unknown): Jsonable => {
    if (input === null || typeof input !== "object") return input as Jsonable;
    if (seen.has(input as object)) return "[Circular]";
    seen.add(input as object);
    if (Array.isArray(input)) return input.map(helper);
    const out: Record<string, Jsonable> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      out[key] = helper((input as Record<string, unknown>)[key]);
    }
    return out;
  };
  return JSON.stringify(helper(value));
}

function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hashObject(value: unknown): string {
  return hashText(stableStringify(value));
}

function distance(a: XYPoint, b: XYPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z ?? 0) - (b.z ?? 0)) ** 2);
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Task bidding and commit separation
// ---------------------------------------------------------------------------

export class TaskBidRegistry {
  private readonly windows = new Map<TaskId, BidWindow>();
  private readonly bids = new Map<TaskId, TaskBid[]>();
  private readonly weighted = new Map<EventId, WeightedBid>();
  private readonly commits = new Map<TaskId, BidCommitRecord>();
  private readonly history: Array<{ tsMs: TimestampMs; type: string; payload: Record<string, unknown> }> = [];

  openWindow(task: TaskWorkItem, minBids = 1, quorum = 1, ttlMs = 4_000): BidWindow {
    const t = nowMs();
    const win: BidWindow = {
      taskId: task.taskId,
      missionId: task.missionId,
      openedAtMs: t,
      closesAtMs: t + ttlMs,
      closedAtMs: null,
      status: "open",
      minBids,
      requiredQuorum: quorum,
      metadata: { scenario: task.scenario, taskType: task.taskType, priority: task.priority },
    };
    this.windows.set(task.taskId, win);
    this.history.push({ tsMs: t, type: "window_open", payload: { taskId: task.taskId, missionId: task.missionId, ttlMs } });
    return win;
  }

  closeWindow(taskId: TaskId, reason = "manual_close"): BidWindow | null {
    const current = this.windows.get(taskId);
    if (!current) return null;
    const t = nowMs();
    current.status = "closed";
    current.closedAtMs = t;
    current.metadata = { ...(current.metadata ?? {}), closeReason: reason };
    this.windows.set(taskId, current);
    this.history.push({ tsMs: t, type: "window_close", payload: { taskId, reason } });
    return current;
  }

  expireWindows(): string[] {
    const now = nowMs();
    const expired: string[] = [];
    for (const [taskId, window] of this.windows.entries()) {
      if (window.status === "open" && now >= window.closesAtMs) {
        window.status = "expired";
        window.closedAtMs = now;
        expired.push(taskId);
      }
    }
    return expired;
  }

  submitBid(bid: TaskBid): TaskBid {
    const window = this.windows.get(bid.taskId);
    if (!window) {
      throw new Error(`no bid window for task: ${bid.taskId}`);
    }
    if (window.status !== "open") {
      throw new Error(`bid window closed for task: ${bid.taskId}`);
    }
    const t = nowMs();
    if (t > window.closesAtMs) {
      window.status = "expired";
      throw new Error(`bid window expired for task: ${bid.taskId}`);
    }
    const list = this.bids.get(bid.taskId) ?? [];
    const dup = list.findIndex((b) => b.bidId === bid.bidId);
    const next = { ...bid, status: TaskBidStatus.Submitted };
    if (dup >= 0) list[dup] = next;
    else list.push(next);
    this.bids.set(bid.taskId, list);
    this.history.push({ tsMs: t, type: "bid_submit", payload: { taskId: bid.taskId, nodeId: bid.nodeId, bidId: bid.bidId } });
    return bid;
  }

  setWeighted(bid: WeightedBid): WeightedBid {
    this.weighted.set(bid.bidId, bid);
    const list = this.bids.get(bid.taskId) ?? [];
    const idx = list.findIndex((b) => b.bidId === bid.bidId);
    if (idx >= 0) list[idx] = { ...list[idx], status: TaskBidStatus.Weighted };
    this.bids.set(bid.taskId, list);
    this.history.push({
      tsMs: nowMs(),
      type: "bid_weighted",
      payload: { taskId: bid.taskId, bidId: bid.bidId, nodeId: bid.nodeId, score: bid.score.total },
    });
    return bid;
  }

  bidsForTask(taskId: TaskId): TaskBid[] {
    return [...(this.bids.get(taskId) ?? [])];
  }

  weightedBidsForTask(taskId: TaskId): WeightedBid[] {
    return [...this.weighted.values()].filter((b) => b.taskId === taskId).sort((a, b) => b.score.total - a.score.total || a.etaMs - b.etaMs);
  }

  bestBid(taskId: TaskId): WeightedBid | null {
    return this.weightedBidsForTask(taskId)[0] ?? null;
  }

  buildCommit(task: TaskWorkItem, winningBid: TaskBid, bidsSeen: number, requestedBy: NodeId, reason: string): BidCommitRecord {
    return {
      commitId: newId("commit"),
      missionId: task.missionId,
      taskId: task.taskId,
      phase: "bidding",
      winnerNodeId: winningBid.nodeId,
      winningBidId: winningBid.bidId,
      bidsSeen,
      consensusSequence: 0,
      committedAtMs: nowMs(),
      proofHash: hashObject({ task, winningBid, requestedBy, reason, bidsSeen }),
      metadata: { requestedBy, reason, taskType: task.taskType, scenario: task.scenario },
    };
  }

  buildAbortCommit(task: TaskWorkItem, requestedBy: NodeId, reason: string): BidCommitRecord {
    return {
      commitId: newId("abort"),
      missionId: task.missionId,
      taskId: task.taskId,
      phase: "aborted",
      winnerNodeId: null,
      winningBidId: null,
      bidsSeen: 0,
      consensusSequence: 0,
      committedAtMs: nowMs(),
      proofHash: hashObject({ task, requestedBy, reason, aborted: true }),
      metadata: { requestedBy, reason, taskType: task.taskType, scenario: task.scenario },
    };
  }

  markCommitted(taskId: TaskId, winnerNodeId: NodeId, winningBidId: EventId, consensusSequence: number, proofHash: string): BidCommitRecord {
    const bidsSeen = this.bidsForTask(taskId).length;
    const record: BidCommitRecord = {
      commitId: newId("commit"),
      missionId: this.windows.get(taskId)?.missionId ?? "",
      taskId,
      phase: "committed",
      winnerNodeId,
      winningBidId,
      bidsSeen,
      consensusSequence,
      committedAtMs: nowMs(),
      proofHash,
      metadata: { winnerChosenFrom: "lattice_ranked_bids" },
    };
    this.commits.set(taskId, record);
    const window = this.windows.get(taskId);
    if (window) {
      window.status = "committed";
      window.closedAtMs = nowMs();
      window.acceptedWinnerId = winnerNodeId;
      window.winningBidId = winningBidId;
      this.windows.set(taskId, window);
    }
    this.history.push({ tsMs: nowMs(), type: "bid_commit", payload: record as unknown as Record<string, unknown> });
    return record;
  }

  rejectBid(taskId: TaskId, bidId: EventId, reason: string): void {
    const list = this.bids.get(taskId) ?? [];
    const idx = list.findIndex((b) => b.bidId === bidId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: TaskBidStatus.Rejected, metadata: { ...(list[idx].metadata ?? {}), rejectReason: reason } };
      this.bids.set(taskId, list);
      this.history.push({ tsMs: nowMs(), type: "bid_reject", payload: { taskId, bidId, reason } });
    }
  }

  cancelTask(taskId: TaskId, reason: string): void {
    const window = this.windows.get(taskId);
    if (window) {
      window.status = "cancelled";
      window.closedAtMs = nowMs();
      window.metadata = { ...(window.metadata ?? {}), cancelReason: reason };
      this.windows.set(taskId, window);
    }
    const list = this.bids.get(taskId) ?? [];
    for (let i = 0; i < list.length; i += 1) {
      list[i] = { ...list[i], status: TaskBidStatus.Cancelled, metadata: { ...(list[i].metadata ?? {}), cancelReason: reason } };
    }
    this.bids.set(taskId, list);
    this.history.push({ tsMs: nowMs(), type: "task_cancel", payload: { taskId, reason } });
  }

  getCommit(taskId: TaskId): BidCommitRecord | null {
    return this.commits.get(taskId) ?? null;
  }

  getWindow(taskId: TaskId): BidWindow | null {
    return this.windows.get(taskId) ?? null;
  }

  summary(): Record<string, unknown> {
    return {
      openWindows: [...this.windows.values()].filter((w) => w.status === "open").length,
      committed: this.commits.size,
      totalBids: [...this.bids.values()].reduce((acc, arr) => acc + arr.length, 0),
      weightedBids: this.weighted.size,
      historyTail: this.history.slice(-50),
    };
  }

  recentHistory(limit = 100): Array<{ tsMs: TimestampMs; type: string; payload: Record<string, unknown> }> {
    return this.history.slice(-limit);
  }
}

export class BidScorer {
  score(task: TaskWorkItem, node: NodeProfile, bid: Omit<TaskBid, "status">): BidScoreBreakdown {
    const reasons: string[] = [];
    let capability = 0;
    let roleFit = 0;
    let scenarioFit = 0;
    let trust = 0;
    let reputation = 0;
    let battery = 0;
    let linkQuality = 0;
    let distanceScore = 0;
    let etaScore = 0;
    let confidence = 0;
    let penalties = 0;

    const capabilityHits = task.requiredCapabilities.filter((cap) => node.capabilityProfile.tags.includes(cap));
    capability = task.requiredCapabilities.length > 0 ? (capabilityHits.length / task.requiredCapabilities.length) * 30 : 12;
    if (capabilityHits.length > 0) reasons.push(`capabilities:${capabilityHits.join(",")}`);

    const nodeRole = node.role;
    const taskLower = task.taskType.toLowerCase();
    if (nodeRole === NodeRole.Relay && taskLower.includes("relay")) {
      roleFit += 14;
      reasons.push("role_match:relay");
    }
    if (nodeRole === NodeRole.Explorer && taskLower.includes("search")) {
      roleFit += 12;
      reasons.push("role_match:explorer");
    }
    if (nodeRole === NodeRole.Triage && taskLower.includes("triage")) {
      roleFit += 12;
      reasons.push("role_match:triage");
    }
    if (nodeRole === NodeRole.Rescuer && (taskLower.includes("rescue") || taskLower.includes("extract"))) {
      roleFit += 14;
      reasons.push("role_match:rescuer");
    }
    if (nodeRole === NodeRole.Transport && taskLower.includes("transport")) {
      roleFit += 13;
      reasons.push("role_match:transport");
    }

    const scenario = task.scenario;
    if (scenario === ScenarioKind.Wildfire && node.capabilityProfile.tags.some((t) => ["thermal", "smoke_resistant", "high_temp"].includes(t))) {
      scenarioFit += 15;
      reasons.push("scenario_fit:wildfire");
    }
    if (scenario === ScenarioKind.CaveTunnel && node.capabilityProfile.tags.some((t) => ["relay", "long_range", "indoor"].includes(t))) {
      scenarioFit += 15;
      reasons.push("scenario_fit:cave_tunnel");
    }
    if (scenario === ScenarioKind.Flood && node.capabilityProfile.tags.some((t) => ["waterproof", "payload"].includes(t))) {
      scenarioFit += 15;
      reasons.push("scenario_fit:flood");
    }
    if (scenario === ScenarioKind.Indoor && node.capabilityProfile.indoorSuitability >= 0.7) {
      scenarioFit += 12;
      reasons.push("scenario_fit:indoor");
    }
    if (scenario === ScenarioKind.Forest && node.capabilityProfile.outdoorSuitability >= 0.7) {
      scenarioFit += 12;
      reasons.push("scenario_fit:forest");
    }

    trust = node.trustScore * 18;
    reputation = node.reputationScore * 16;
    battery = (node.health.batteryPct / 100) * 10;
    linkQuality = node.health.linkQuality * 8;
    confidence = clamp(bid.confidence, 0, 1) * 8;

    if (task.location && node.location) {
      const dist = distance(task.location, node.location);
      distanceScore = Math.max(0, 12 - (dist / Math.max(1, task.maxDistanceM ?? 500)) * 12);
      reasons.push(`distance:${round2(dist)}`);
    }

    etaScore = Math.max(0, 10 - (bid.etaMs / 1000) * 1.5);
    if (bid.resources?.relay === true) reasons.push("resource:relay");
    if (bid.resources?.vehicle === true) reasons.push("resource:vehicle");
    if (bid.resources?.gripper === true) reasons.push("resource:gripper");

    if (node.health.batteryPct < task.minBatteryPct) penalties += 30;
    if (node.trustScore < task.minTrustScore) penalties += 20;
    if (node.health.linkQuality < 0.2) penalties += 15;
    if (node.health.gpsFix === false && scenario !== ScenarioKind.CaveTunnel && scenario !== ScenarioKind.Indoor) penalties += 6;

    const total = capability + roleFit + scenarioFit + trust + reputation + battery + linkQuality + distanceScore + etaScore + confidence - penalties;

    return {
      total: round2(total),
      capability: round2(capability),
      trust: round2(trust),
      reputation: round2(reputation),
      battery: round2(battery),
      linkQuality: round2(linkQuality),
      distance: round2(distanceScore),
      eta: round2(etaScore),
      confidence: round2(confidence),
      roleFit: round2(roleFit),
      scenarioFit: round2(scenarioFit),
      penalties: round2(penalties),
      reasons,
    };
  }
}

export class BidDecisionEngine {
  constructor(private readonly scorer = new BidScorer()) {}

  chooseBest(task: TaskWorkItem, node: NodeProfile, bid: Omit<TaskBid, "status">): WeightedBid {
    return {
      ...bid,
      status: TaskBidStatus.Weighted,
      score: this.scorer.score(task, node, bid),
    };
  }

  rank(task: TaskWorkItem, bids: Array<{ bid: TaskBid; node: NodeProfile }>): WeightedBid[] {
    return bids
      .map(({ bid, node }) => this.chooseBest(task, node, bid))
      .sort((a, b) => b.score.total - a.score.total || a.etaMs - b.etaMs || b.confidence - a.confidence);
  }
}

// ---------------------------------------------------------------------------
// Vertex-ordered assignment commit
// ---------------------------------------------------------------------------

export class TaskCommitCoordinator {
  private readonly lastKnownTaskById = new Map<TaskId, TaskWorkItem>();
  private readonly commitmentLog: BidCommitRecord[] = [];

  constructor(
    private readonly lattice: LatticeValidationAdapter,
    private readonly vertex: VertexCommitAdapter,
    private readonly ledger: EventLedgerStore,
    private readonly rewards?: RewardAdapter,
  ) {}

  registerTask(task: TaskWorkItem): void {
    this.lastKnownTaskById.set(task.taskId, task);
  }

  getTask(taskId: TaskId): TaskWorkItem | null {
    return this.lastKnownTaskById.get(taskId) ?? null;
  }

  async collectAndCommit(task: TaskWorkItem, bids: TaskBid[], requestorId: NodeId, reason = "bidding_complete"): Promise<BidCommitRecord> {
    this.registerTask(task);

    const valid: Array<{ bid: TaskBid; node: NodeProfile; score: BidScoreBreakdown }> = [];
    for (const bid of bids) {
      const node = this.lattice.getNode(bid.nodeId);
      if (!node) continue;
      const verdict = this.lattice.validateBid(bid, node, task);
      if (!verdict.accepted) continue;
      valid.push({ bid, node, score: verdict.score });
    }

    if (valid.length === 0) {
      const aborted = this.buildAbortCommit(task, requestorId, `${reason}:no_valid_bids`);
      const ordered = await this.vertex.submitOrderedAssignment(aborted);
      aborted.consensusSequence = ordered.sequence;
      aborted.proofHash = ordered.proofHash;
      this.commitmentLog.push(aborted);
      return aborted;
    }

    const ranked = valid
      .map(({ bid, node, score }) => ({
        bid,
        node,
        score,
        total: score.total,
      }))
      .sort((a, b) => b.total - a.total || a.bid.etaMs - b.bid.etaMs || b.score.confidence - a.score.confidence);

    const winner = ranked[0];
    const commitRecord = this.buildCommit(task, winner.bid, ranked.length, requestorId, reason);

    const ordered = await this.vertex.submitOrderedAssignment(commitRecord);
    commitRecord.consensusSequence = ordered.sequence;
    commitRecord.proofHash = ordered.proofHash;
    commitRecord.winnerNodeId = winner.bid.nodeId;
    commitRecord.winningBidId = winner.bid.bidId;
    commitRecord.phase = "committed";

    const saved = this.ledger.append({
      missionId: task.missionId,
      kind: "task_assignment_committed",
      actorId: requestorId,
      payload: {
        taskId: task.taskId,
        winnerNodeId: winner.bid.nodeId,
        winningBidId: winner.bid.bidId,
        totalBids: bids.length,
        validBids: ranked.length,
        reason,
        proofHash: commitRecord.proofHash,
      },
    });
    commitRecord.metadata = { ...commitRecord.metadata, ledgerHash: saved.cumulativeHash };

    this.commitmentLog.push(commitRecord);
    this.lastKnownTaskById.set(task.taskId, task);

    this.rewards?.recordWork?.({
      missionId: task.missionId,
      nodeId: winner.bid.nodeId,
      kind: RewardKind.Work,
      amount: Math.max(1, Math.round(winner.score.total / 10)),
      reason: `task_committed:${task.taskType}`,
      metadata: { taskId: task.taskId, proofHash: commitRecord.proofHash, bidId: winner.bid.bidId },
    });

    return commitRecord;
  }

  buildCommit(task: TaskWorkItem, winningBid: TaskBid, bidsSeen: number, requestedBy: NodeId, reason: string): BidCommitRecord {
    return {
      commitId: newId("commit"),
      missionId: task.missionId,
      taskId: task.taskId,
      phase: "bidding",
      winnerNodeId: winningBid.nodeId,
      winningBidId: winningBid.bidId,
      bidsSeen,
      consensusSequence: 0,
      committedAtMs: nowMs(),
      proofHash: hashObject({ task, winningBid, requestedBy, reason, bidsSeen }),
      metadata: { requestedBy, reason, taskType: task.taskType, scenario: task.scenario },
    };
  }

  buildAbortCommit(task: TaskWorkItem, requestedBy: NodeId, reason: string): BidCommitRecord {
    return {
      commitId: newId("abort"),
      missionId: task.missionId,
      taskId: task.taskId,
      phase: "aborted",
      winnerNodeId: null,
      winningBidId: null,
      bidsSeen: 0,
      consensusSequence: 0,
      committedAtMs: nowMs(),
      proofHash: hashObject({ task, requestedBy, reason, aborted: true }),
      metadata: { requestedBy, reason, taskType: task.taskType, scenario: task.scenario },
    };
  }

  commitments(): BidCommitRecord[] {
    return [...this.commitmentLog];
  }
}

// ---------------------------------------------------------------------------
// Ledger and checkpoint support
// ---------------------------------------------------------------------------

export class EventLedgerStore {
  private readonly entries: LedgerEvent[] = [];
  private readonly byMission = new Map<MissionId, LedgerEvent[]>();

  append(entry: Omit<LedgerEvent, "eventId" | "previousHash" | "timestampMs" | "signature" | "nonce" | "blockIndex" | "cumulativeHash">): LedgerEvent {
    const previousHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].cumulativeHash : "genesis";
    const nonce = `n-${randomUUID()}`;
    const base = {
      eventId: newId("evt"),
      missionId: entry.missionId,
      kind: entry.kind,
      actorId: entry.actorId,
      payload: entry.payload,
      previousHash,
      timestampMs: nowMs(),
      nonce,
      blockIndex: this.entries.length,
    };
    const signature = hashObject(base);
    const cumulativeHash = hashObject({ ...base, signature });
    const record: LedgerEvent = { ...base, signature, cumulativeHash };
    this.entries.push(record);
    const list = this.byMission.get(entry.missionId) ?? [];
    list.push(record);
    this.byMission.set(entry.missionId, list);
    return record;
  }

  lastHash(): string {
    return this.entries.length ? this.entries[this.entries.length - 1].cumulativeHash : "genesis";
  }

  /** Mission events strictly after ``afterCumulativeHash`` (exclusive). If hash is unknown, returns the full mission slice (caller may treat as degraded replay). */
  missionEventsAfter(missionId: MissionId, afterCumulativeHash: string | null): LedgerEvent[] {
    const list = this.byMission.get(missionId) ?? [];
    if (!afterCumulativeHash || afterCumulativeHash === "genesis") return [...list];
    const idx = list.findIndex((e) => e.cumulativeHash === afterCumulativeHash);
    if (idx < 0) return [...list];
    return list.slice(idx + 1);
  }

  tail(limit = 100): LedgerEvent[] {
    return this.entries.slice(-limit);
  }

  all(): LedgerEvent[] {
    return [...this.entries];
  }

  byMissionId(missionId: MissionId): LedgerEvent[] {
    return [...(this.byMission.get(missionId) ?? [])];
  }

  verify(): { ok: boolean; reason: string } {
    let previous = "genesis";
    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      if (entry.blockIndex !== i) return { ok: false, reason: `bad_block_index:${i}` };
      if (entry.previousHash !== previous) return { ok: false, reason: `bad_previous_hash:${i}` };
      const { signature, cumulativeHash, ...base } = entry;
      if (signature !== hashObject(base)) return { ok: false, reason: `bad_signature:${i}` };
      const expectedCumulative = hashObject({ ...base, signature });
      if (cumulativeHash !== expectedCumulative) return { ok: false, reason: `bad_hash:${i}` };
      previous = entry.cumulativeHash;
    }
    return { ok: true, reason: "ok" };
  }
}

export interface CheckpointStoreAdapter {
  save(checkpoint: RecoveryCheckpoint): void;
  latest(missionId: MissionId): RecoveryCheckpoint | null;
  list(missionId?: MissionId): RecoveryCheckpoint[];
}

export class InMemoryCheckpointStore implements CheckpointStoreAdapter {
  private readonly checkpoints = new Map<CheckpointId, RecoveryCheckpoint>();
  private readonly byMission = new Map<MissionId, CheckpointId[]>();

  save(checkpoint: RecoveryCheckpoint): void {
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
    const ids = this.byMission.get(checkpoint.missionId) ?? [];
    ids.push(checkpoint.checkpointId);
    this.byMission.set(checkpoint.missionId, ids);
  }

  latest(missionId: MissionId): RecoveryCheckpoint | null {
    const list = this.list(missionId);
    if (list.length === 0) return null;
    return list.reduce((a, b) => (a.createdAtMs >= b.createdAtMs ? a : b));
  }

  list(missionId?: MissionId): RecoveryCheckpoint[] {
    if (!missionId) return [...this.checkpoints.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
    return (this.byMission.get(missionId) ?? [])
      .map((id) => this.checkpoints.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.createdAtMs - b!.createdAtMs) as RecoveryCheckpoint[];
  }
}

export interface RecoveryReplayContext {
  missionId: MissionId;
  ledger: EventLedgerStore;
  checkpointStore: CheckpointStoreAdapter;
  map: {
    snapshot(): MapSnapshot;
    mergeSnapshot(snapshot: MapSnapshot, sourceNodeId?: NodeId): { inserted: number; updated: number; ignored: number };
    getVersion(): Version;
    dirtyCount(): number;
  };
  mission: {
    phase: MissionPhase;
    phaseVersion: Version;
    context: {
      missionId: MissionId;
      nodes: Record<NodeId, NodeProfile>;
      targets: Record<TargetId, TargetRecord>;
      objectives: MissionObjectives;
      metadata: Record<string, unknown>;
    };
    setPhase?(phase: MissionPhase): void;
    registerNode?(node: NodeProfile): NodeProfile;
    upsertTarget?(target: TargetRecord): TargetRecord;
  };
  lattice: LatticeValidationAdapter;
}

function applyCheckpointBaseline(ctx: RecoveryReplayContext, cp: RecoveryCheckpoint): void {
  ctx.mission.context.targets = { ...cp.targetRegistry };
  if (ctx.mission.setPhase) {
    ctx.mission.setPhase(cp.phase);
    ctx.mission.phaseVersion = cp.phaseVersion;
  } else {
    ctx.mission.phase = cp.phase;
    ctx.mission.phaseVersion = cp.phaseVersion;
  }
  for (const id of cp.activeNodeIds) {
    const cur = ctx.mission.context.nodes[id];
    const sum = cp.nodeSummary[id];
    if (!cur || !sum) continue;
    ctx.mission.context.nodes[id] = {
      ...cur,
      role: sum.role,
      trustScore: sum.trustScore,
      reputationScore: sum.reputationScore,
      health: {
        ...cur.health,
        batteryPct: sum.batteryPct,
        linkQuality: sum.linkQuality,
        timestampMs: sum.lastSeenMs ?? cur.health.timestampMs,
      },
      lastSeenMs: sum.lastSeenMs ?? cur.lastSeenMs,
    };
  }
}

export class RecoveryCheckpointManager {
  constructor(private readonly store: CheckpointStoreAdapter) {}

  createCheckpoint(args: {
    missionId: MissionId;
    phase: MissionPhase;
    phaseVersion: Version;
    consensusSequence: number;
    map: MapSnapshot;
    nodes: NodeProfile[];
    targets: TargetRecord[];
    lastLedgerHash: string;
    previousCheckpointHash?: string;
    createdBy: NodeId;
    reason: string;
    metadata?: Record<string, unknown>;
  }): RecoveryCheckpoint {
    const nodeSummary: RecoveryCheckpoint["nodeSummary"] = {};
    for (const node of args.nodes) {
      nodeSummary[node.nodeId] = {
        role: node.role,
        batteryPct: node.health.batteryPct,
        linkQuality: node.health.linkQuality,
        trustScore: node.trustScore,
        reputationScore: node.reputationScore,
        lastSeenMs: node.lastSeenMs,
      };
    }

    const targetRegistry: Record<TargetId, TargetRecord> = {};
    for (const target of args.targets) targetRegistry[target.targetId] = target;

    const checkpointId = newId("cp");
    const body = {
      checkpointId,
      missionId: args.missionId,
      phase: args.phase,
      phaseVersion: args.phaseVersion,
      consensusSequence: args.consensusSequence,
      mapVersion: args.map.version,
      mapHash: hashObject(args.map),
      activeNodeIds: args.nodes.filter((n) => n.health.linkQuality > 0.1 && n.health.batteryPct > 0).map((n) => n.nodeId).sort(),
      targetRegistry,
      nodeSummary,
      lastLedgerHash: args.lastLedgerHash,
      previousCheckpointHash: args.previousCheckpointHash ?? "genesis",
      createdAtMs: nowMs(),
      createdBy: args.createdBy,
      reason: args.reason,
      metadata: args.metadata ?? {},
    };

    const checkpoint: RecoveryCheckpoint = {
      ...body,
      proofHash: hashObject(body),
    };
    this.store.save(checkpoint);
    return checkpoint;
  }

  latest(missionId: MissionId): RecoveryCheckpoint | null {
    return this.store.latest(missionId);
  }

  list(missionId?: MissionId): RecoveryCheckpoint[] {
    return this.store.list(missionId);
  }

  verifyIntegrity(checkpoint: RecoveryCheckpoint): boolean {
    const { proofHash, ...base } = checkpoint;
    return hashObject(base) === proofHash;
  }

  /**
   * @param currentLedgerHash — ledger head to compare against (use checkpoint's own ``lastLedgerHash`` to verify only structure + integrity after sealing).
   * @param currentMapVersion — live map version at verification time.
   */
  verify(checkpoint: RecoveryCheckpoint, currentLedgerHash: string, currentMapVersion: Version, staleThresholdMs = 15_000): CheckpointVerification {
    const missingFields: string[] = [];
    if (!checkpoint.checkpointId) missingFields.push("checkpointId");
    if (!checkpoint.missionId) missingFields.push("missionId");
    if (!checkpoint.phase) missingFields.push("phase");
    if (!checkpoint.lastLedgerHash) missingFields.push("lastLedgerHash");
    if (!checkpoint.mapHash) missingFields.push("mapHash");
    if (!checkpoint.activeNodeIds) missingFields.push("activeNodeIds");
    if (!checkpoint.targetRegistry) missingFields.push("targetRegistry");
    if (!checkpoint.nodeSummary) missingFields.push("nodeSummary");

    const integrityOk = this.verifyIntegrity(checkpoint);

    const staleNodes: NodeId[] = [];
    const t = nowMs();
    for (const [nodeId, summary] of Object.entries(checkpoint.nodeSummary ?? {})) {
      if (summary.batteryPct <= 0 || summary.linkQuality <= 0) staleNodes.push(nodeId);
      else if (summary.lastSeenMs != null && t - summary.lastSeenMs > staleThresholdMs) staleNodes.push(nodeId);
    }

    const ledgerMismatch = checkpoint.lastLedgerHash !== currentLedgerHash;
    const versionMismatch = checkpoint.mapVersion !== currentMapVersion;
    const ok =
      missingFields.length === 0 &&
      integrityOk &&
      !ledgerMismatch &&
      !versionMismatch;

    return {
      ok,
      reason: ok ? "ok" : "checkpoint_verification_failed",
      missingFields,
      staleNodes,
      versionMismatch,
      ledgerMismatch,
      integrityOk,
    };
  }
}

export class MissionRecoveryPlanner {
  constructor(
    private readonly checkpointManager: RecoveryCheckpointManager,
    private readonly ledger: EventLedgerStore,
  ) {}

  buildPlan(ctx: RecoveryReplayContext): RecoveryPlan {
    const restoreCheckpoint = this.checkpointManager.latest(ctx.missionId);
    const replayEvents = this.ledger.missionEventsAfter(ctx.missionId, restoreCheckpoint?.lastLedgerHash ?? null);
    const syncHints = this.computeSyncHints(ctx, restoreCheckpoint);
    const trustRevalidationNeeded = syncHints.filter((h) => h.needsMap || h.needsTasks).map((h) => h.peerId);

    return {
      missionId: ctx.missionId,
      restoreCheckpoint,
      replayEvents,
      syncNeededFromPeers: syncHints.filter((h) => h.needsMap || h.needsTasks).map((h) => h.peerId),
      trustRevalidationNeeded,
      mapSyncNeeded: syncHints.some((h) => h.needsMap),
      taskSyncNeeded: syncHints.some((h) => h.needsTasks),
      recommendations: this.buildRecommendations(ctx, restoreCheckpoint, replayEvents, syncHints),
    };
  }

  /**
   * Applies the latest checkpoint as baseline (targets, phase, node summaries), then
   * replays ledger events after ``checkpoint.lastLedgerHash``.
   */
  restore(ctx: RecoveryReplayContext): { checkpoint: RecoveryCheckpoint | null; replayCount: number; syncHints: RecoverySyncHint[] } {
    const checkpoint = this.checkpointManager.latest(ctx.missionId);
    if (checkpoint) applyCheckpointBaseline(ctx, checkpoint);
    const replayEvents = this.ledger.missionEventsAfter(ctx.missionId, checkpoint?.lastLedgerHash ?? null);
    for (const event of replayEvents) {
      this.applyLedgerEvent(ctx, event);
    }
    const syncHints = this.computeSyncHints(ctx, checkpoint);
    return { checkpoint, replayCount: replayEvents.length, syncHints };
  }

  createCheckpoint(ctx: RecoveryReplayContext, reason: string, createdBy: NodeId, consensusSequence = 0): RecoveryCheckpoint {
    const mapSnapshot = ctx.map.snapshot();
    const prev = this.checkpointManager.latest(ctx.missionId);
    return this.checkpointManager.createCheckpoint({
      missionId: ctx.missionId,
      phase: ctx.mission.phase,
      phaseVersion: ctx.mission.phaseVersion,
      consensusSequence,
      map: mapSnapshot,
      nodes: Object.values(ctx.mission.context.nodes),
      targets: Object.values(ctx.mission.context.targets),
      lastLedgerHash: this.ledger.lastHash(),
      previousCheckpointHash: prev?.proofHash ?? "genesis",
      createdBy,
      reason,
      metadata: {
        dirtyMap: ctx.map.dirtyCount(),
        objectiveCoverage: mapSnapshot.coveragePct,
      },
    });
  }

  validateCheckpoint(ctx: RecoveryReplayContext, checkpoint: RecoveryCheckpoint, ledgerHead = ctx.ledger.lastHash()): CheckpointVerification {
    return this.checkpointManager.verify(checkpoint, ledgerHead, ctx.map.getVersion());
  }

  private applyLedgerEvent(ctx: RecoveryReplayContext, event: LedgerEvent): void {
    switch (event.kind) {
      case "node_register": {
        const node = event.payload.node as NodeProfile | undefined;
        if (node && ctx.mission.registerNode) ctx.mission.registerNode(node);
        break;
      }
      case "node_update": {
        const nodeId = String(event.payload.nodeId ?? "");
        const patch = event.payload.patch as Partial<NodeProfile> | undefined;
        if (nodeId && patch && ctx.mission.context.nodes[nodeId] && ctx.mission.registerNode) {
          ctx.mission.registerNode({
            ...ctx.mission.context.nodes[nodeId],
            ...patch,
            metadata: { ...(ctx.mission.context.nodes[nodeId].metadata ?? {}), replayed: true },
          });
        }
        break;
      }
      case "target_upsert": {
        const target = event.payload.target as TargetRecord | undefined;
        if (target && ctx.mission.upsertTarget) ctx.mission.upsertTarget(target);
        break;
      }
      case "target_confirm": {
        const targetId = String(event.payload.targetId ?? "");
        const nodeId = String(event.payload.nodeId ?? "");
        if (targetId && nodeId && ctx.mission.context.targets[targetId]) {
          ctx.mission.context.targets[targetId].status = "confirmed";
          ctx.mission.context.targets[targetId].confirmedBy = [...new Set([...ctx.mission.context.targets[targetId].confirmedBy, nodeId])];
          ctx.mission.context.targets[targetId].confirmedAtMs = ctx.mission.context.targets[targetId].confirmedAtMs ?? nowMs();
        }
        break;
      }
      case "target_assign": {
        const targetId = String(event.payload.targetId ?? "");
        const nodeId = String(event.payload.nodeId ?? "");
        if (targetId && nodeId && ctx.mission.context.targets[targetId]) {
          ctx.mission.context.targets[targetId].status = "assigned";
          ctx.mission.context.targets[targetId].assignedTo = nodeId;
          ctx.mission.context.targets[targetId].assignedAtMs = nowMs();
        }
        break;
      }
      case "target_extract": {
        const targetId = String(event.payload.targetId ?? "");
        const nodeId = String(event.payload.nodeId ?? "");
        if (targetId && nodeId && ctx.mission.context.targets[targetId]) {
          ctx.mission.context.targets[targetId].status = "extracted";
          ctx.mission.context.targets[targetId].extractedBy = nodeId;
          ctx.mission.context.targets[targetId].extractedAtMs = nowMs();
        }
        break;
      }
      case "phase_transition_commit": {
        const to = String(event.payload.to ?? "") as MissionPhase;
        if (to && ctx.mission.setPhase) ctx.mission.setPhase(to);
        break;
      }
      case "map_snapshot_merge": {
        const snapshot = event.payload.snapshot as MapSnapshot | undefined;
        if (snapshot) ctx.map.mergeSnapshot(snapshot, event.actorId);
        break;
      }
      default:
        break;
    }
  }

  private computeSyncHints(ctx: RecoveryReplayContext, checkpoint: RecoveryCheckpoint | null): RecoverySyncHint[] {
    const hints: RecoverySyncHint[] = [];
    const checkpointNodeIds = new Set(checkpoint?.activeNodeIds ?? []);
    for (const node of Object.values(ctx.mission.context.nodes)) {
      const needsMap = checkpoint != null && checkpoint.mapVersion < ctx.map.getVersion() && node.nodeId !== checkpoint.createdBy;
      const needsTasks = checkpoint != null && !checkpointNodeIds.has(node.nodeId);
      if (needsMap || needsTasks) {
        hints.push({
          peerId: node.nodeId,
          needsMap,
          needsTasks,
          reason: needsMap && needsTasks ? "missing_map_and_task_state" : needsMap ? "missing_map_state" : "missing_task_state",
        });
      }
    }
    return hints;
  }

  private buildRecommendations(
    ctx: RecoveryReplayContext,
    checkpoint: RecoveryCheckpoint | null,
    replayEvents: LedgerEvent[],
    syncHints: RecoverySyncHint[],
  ): string[] {
    const out: string[] = [];
    if (!checkpoint) out.push("No checkpoint found; bootstrap from full ledger replay.");
    else {
      out.push(`Restore checkpoint ${checkpoint.checkpointId} at phase ${checkpoint.phase} (seq ${checkpoint.consensusSequence}).`);
      out.push(`Replay ${replayEvents.length} ledger events after sealed hash ${checkpoint.lastLedgerHash.slice(0, 12)}…`);
    }
    if (!checkpoint && replayEvents.length > 0) out.push(`Replay ${replayEvents.length} ledger events to rebuild mission state.`);
    if (syncHints.some((h) => h.needsMap)) out.push("Request map sync from peers with newer map versions.");
    if (syncHints.some((h) => h.needsTasks)) out.push("Request task/state sync from peers with newer assignment state.");
    if (ctx.mission.context.objectives.safetyCritical) out.push("Revalidate trust and safety thresholds before resuming the mission.");
    return out;
  }
}

// ---------------------------------------------------------------------------
// High-level mission bridge for Vertex/Lattice integration
// ---------------------------------------------------------------------------

export interface IntegratedMissionContext {
  missionId: MissionId;
  map: RecoveryReplayContext["map"];
  mission: RecoveryReplayContext["mission"];
  lattice: LatticeValidationAdapter;
  vertex: VertexCommitAdapter;
  ledger: EventLedgerStore;
  rewards?: RewardAdapter;
}

export class MissionExecutionCoordinator {
  private readonly bids = new TaskBidRegistry();
  private readonly scorer = new BidScorer();
  private readonly decisionEngine = new BidDecisionEngine(this.scorer);
  private readonly commitHistory: BidCommitRecord[] = [];
  private readonly checkpointStore: InMemoryCheckpointStore;
  private readonly checkpointManager: RecoveryCheckpointManager;
  private readonly recoveryPlanner: MissionRecoveryPlanner;
  private readonly ledger: EventLedgerStore;
  private readonly lattice: LatticeValidationAdapter;
  private readonly vertex: VertexCommitAdapter;
  private readonly mission: IntegratedMissionContext["mission"];
  private readonly map: IntegratedMissionContext["map"];
  private readonly rewards?: RewardAdapter;
  private readonly missionId: MissionId;

  constructor(ctx: IntegratedMissionContext) {
    this.missionId = ctx.missionId;
    this.map = ctx.map;
    this.mission = ctx.mission;
    this.lattice = ctx.lattice;
    this.vertex = ctx.vertex;
    this.ledger = ctx.ledger;
    this.rewards = ctx.rewards;
    this.checkpointStore = new InMemoryCheckpointStore();
    this.checkpointManager = new RecoveryCheckpointManager(this.checkpointStore);
    this.recoveryPlanner = new MissionRecoveryPlanner(this.checkpointManager, this.ledger);
  }

  openBidding(task: TaskWorkItem, minBids = 1, quorum = 1, ttlMs = 4_000): BidWindow {
    const window = this.bids.openWindow(task, minBids, quorum, ttlMs);
    const actor =
      Object.values(this.mission.context.nodes)[0]?.nodeId ??
      (typeof this.mission.context.metadata.defaultActor === "string" ? this.mission.context.metadata.defaultActor : "system");
    this.ledger.append({
      missionId: task.missionId,
      kind: "task_bidding_opened",
      actorId: actor as NodeId,
      payload: {
        taskId: task.taskId,
        scenario: task.scenario,
        taskType: task.taskType,
        minBids,
        quorum,
        closesAtMs: window.closesAtMs,
      },
    });
    return window;
  }

  submitBid(input: Omit<TaskBid, "status">): TaskBid {
    const task = this.getTaskOrThrow(input.taskId);
    const node = this.lattice.getNode(input.nodeId);
    if (!node) throw new Error(`unknown node: ${input.nodeId}`);

    const verdict = this.lattice.validateBid(input as TaskBid, node, task);
    const bid: TaskBid = {
      ...input,
      status: verdict.accepted ? TaskBidStatus.Submitted : TaskBidStatus.Rejected,
      batteryPct: clamp(input.batteryPct, 0, 100),
      linkQuality: clamp(input.linkQuality, 0, 1),
      confidence: clamp(input.confidence, 0, 1),
      createdAtMs: input.createdAtMs || nowMs(),
      expiresAtMs: input.expiresAtMs || nowMs() + 4_000,
      metadata: {
        ...(input.metadata ?? {}),
        validationReasons: verdict.reasons,
        validatorScore: verdict.score.total,
      },
    };

    if (!verdict.accepted) {
      try {
        this.bids.submitBid(bid);
      } catch {
        this.ledger.append({
          missionId: task.missionId,
          kind: "task_bid_rejected",
          actorId: bid.nodeId,
          payload: { taskId: task.taskId, bidId: bid.bidId, reasons: verdict.reasons, score: verdict.score, windowClosed: true },
        });
        return bid;
      }
      this.bids.rejectBid(task.taskId, bid.bidId, verdict.reasons.join(";"));
      this.ledger.append({
        missionId: task.missionId,
        kind: "task_bid_rejected",
        actorId: bid.nodeId,
        payload: { taskId: task.taskId, bidId: bid.bidId, reasons: verdict.reasons, score: verdict.score },
      });
      return bid;
    }

    this.bids.submitBid(bid);
    const weighted = this.decisionEngine.chooseBest(task, node, bid);
    this.bids.setWeighted(weighted);
    this.ledger.append({
      missionId: task.missionId,
      kind: "task_bid_accepted",
      actorId: bid.nodeId,
      payload: { taskId: task.taskId, bidId: bid.bidId, score: weighted.score },
    });
    return bid;
  }

  listBids(taskId: TaskId): TaskBid[] {
    return this.bids.bidsForTask(taskId);
  }

  listWeightedBids(taskId: TaskId): WeightedBid[] {
    return this.bids.weightedBidsForTask(taskId);
  }

  async commitBids(taskId: TaskId, requestedBy: NodeId, reason = "bidding_closed"): Promise<BidCommitRecord> {
    const task = this.getTaskOrThrow(taskId);
    const window = this.bids.getWindow(taskId);
    if (!window) throw new Error(`missing bid window: ${taskId}`);

    const weighted = this.bids.weightedBidsForTask(taskId);
    const fallback = this.bids
      .bidsForTask(taskId)
      .map((bid) => {
        const node = this.lattice.getNode(bid.nodeId);
        if (!node) return null;
        const verdict = this.lattice.validateBid(bid, node, task);
        return { bid, node, score: verdict.score };
      })
      .filter(Boolean) as Array<{ bid: TaskBid; node: NodeProfile; score: BidScoreBreakdown }>;

    const ranked =
      weighted.length > 0
        ? weighted
        : fallback
            .map(({ bid, node }) => this.decisionEngine.chooseBest(task, node, bid))
            .sort((a, b) => b.score.total - a.score.total || a.etaMs - b.etaMs || b.confidence - a.confidence);

    if (ranked.length === 0) {
      const abortRecord = this.bids.buildAbortCommit(task, requestedBy, `${reason}:no_ranked_bids`);
      const ordered = await this.vertex.submitOrderedAssignment(abortRecord);
      abortRecord.consensusSequence = ordered.sequence;
      abortRecord.proofHash = ordered.proofHash;
      this.commitHistory.push(abortRecord);
      this.ledger.append({
        missionId: task.missionId,
        kind: "task_assignment_aborted",
        actorId: requestedBy,
        payload: { taskId, reason },
      });
      this.bids.cancelTask(taskId, reason);
      return abortRecord;
    }

    const winner = ranked[0];
    const commitRecord = this.bids.buildCommit(task, winner, ranked.length, requestedBy, reason);
    const ordered = await this.vertex.submitOrderedAssignment(commitRecord);
    commitRecord.consensusSequence = ordered.sequence;
    commitRecord.proofHash = ordered.proofHash;
    commitRecord.phase = "committed";
    commitRecord.winnerNodeId = winner.nodeId;
    commitRecord.winningBidId = winner.bidId;
    commitRecord.metadata = {
      ...commitRecord.metadata,
      bidCount: ranked.length,
      windowStatus: window.status,
      orderedSequence: ordered.sequence,
    };
    this.commitHistory.push(commitRecord);
    this.bids.markCommitted(taskId, winner.nodeId, winner.bidId, ordered.sequence, ordered.proofHash);
    this.ledger.append({
      missionId: task.missionId,
      kind: "task_assignment_committed",
      actorId: requestedBy,
      payload: {
        taskId,
        winnerNodeId: winner.nodeId,
        winningBidId: winner.bidId,
        bidScore: winner.score,
        consensusSequence: ordered.sequence,
        proofHash: ordered.proofHash,
        reason,
      },
    });

    this.rewards?.recordWork?.({
      missionId: task.missionId,
      nodeId: winner.nodeId,
      kind: RewardKind.Work,
      amount: Math.max(1, Math.round(winner.score.total / 10)),
      reason: `task_assigned:${task.taskType}`,
      metadata: { taskId, bidId: winner.bidId, proofHash: ordered.proofHash },
    });

    return commitRecord;
  }

  latestCommit(taskId: TaskId): BidCommitRecord | null {
    return this.commitHistory.filter((record) => record.taskId === taskId).slice(-1)[0] ?? null;
  }

  commitHistoryTail(limit = 100): BidCommitRecord[] {
    return this.commitHistory.slice(-limit);
  }

  createCheckpoint(requestedBy: NodeId, reason: string, consensusSequence = 0): RecoveryCheckpoint {
    const sealedHead = this.ledger.lastHash();
    const checkpoint = this.recoveryPlanner.createCheckpoint(this.recoveryContext(), reason, requestedBy, consensusSequence);
    this.ledger.append({
      missionId: this.missionId,
      kind: "recovery_checkpoint_created",
      actorId: requestedBy,
      payload: {
        checkpointId: checkpoint.checkpointId,
        phase: checkpoint.phase,
        phaseVersion: checkpoint.phaseVersion,
        consensusSequence: checkpoint.consensusSequence,
        mapVersion: checkpoint.mapVersion,
        mapHash: checkpoint.mapHash,
        activeNodeIds: checkpoint.activeNodeIds,
        lastLedgerHash: checkpoint.lastLedgerHash,
        reason,
        proofHash: checkpoint.proofHash,
      },
    });
    const verified = this.checkpointManager.verify(checkpoint, sealedHead, checkpoint.mapVersion);
    if (!verified.ok) {
      this.ledger.append({
        missionId: this.missionId,
        kind: "recovery_checkpoint_warn",
        actorId: requestedBy,
        payload: {
          checkpointId: checkpoint.checkpointId,
          reason: verified.reason,
          missingFields: verified.missingFields,
          integrityOk: verified.integrityOk,
        },
      });
    }
    void this.vertex.submitCheckpoint?.(checkpoint);
    return checkpoint;
  }

  verifyCheckpoint(checkpoint: RecoveryCheckpoint, ledgerHead?: string): CheckpointVerification {
    return this.recoveryPlanner.validateCheckpoint(this.recoveryContext(), checkpoint, ledgerHead);
  }

  latestCheckpoint(): RecoveryCheckpoint | null {
    return this.checkpointStore.latest(this.missionId);
  }

  buildRecoveryPlan(): RecoveryPlan {
    return this.recoveryPlanner.buildPlan(this.recoveryContext());
  }

  restoreFromLatestCheckpoint(): { checkpoint: RecoveryCheckpoint | null; replayCount: number; syncHints: RecoverySyncHint[] } {
    return this.recoveryPlanner.restore(this.recoveryContext());
  }

  rehydrateMissionState(): { checkpoint: RecoveryCheckpoint | null; replayCount: number; syncHints: RecoverySyncHint[] } {
    const restored = this.restoreFromLatestCheckpoint();
    this.ledger.append({
      missionId: this.missionId,
      kind: "mission_rehydrated",
      actorId: restored.checkpoint?.createdBy ?? "system",
      payload: {
        checkpointId: restored.checkpoint?.checkpointId ?? null,
        replayCount: restored.replayCount,
        syncHints: restored.syncHints,
      },
    });
    return restored;
  }

  requestSyncFromPeers(syncHints: RecoverySyncHint[]): void {
    for (const hint of syncHints) {
      this.ledger.append({
        missionId: this.missionId,
        kind: "sync_request_emitted",
        actorId: hint.peerId,
        payload: {
          peerId: hint.peerId,
          needsMap: hint.needsMap,
          needsTasks: hint.needsTasks,
          reason: hint.reason,
        },
      });
    }
  }

  settlementArtifact(): Record<string, unknown> {
    const latest = this.latestCheckpoint();
    return {
      missionId: this.missionId,
      latestCheckpoint: latest,
      commits: this.commitHistoryTail(50),
      ledgerTail: this.ledger.byMissionId(this.missionId).slice(-100),
      proofHash: hashObject({ latest, commits: this.commitHistoryTail(50), ledgerHash: this.ledger.lastHash() }),
      readyForArc: true,
    };
  }

  private recoveryContext(): RecoveryReplayContext {
    return {
      missionId: this.missionId,
      ledger: this.ledger,
      checkpointStore: this.checkpointStore,
      map: this.map,
      mission: this.mission,
      lattice: this.lattice,
    };
  }

  private getTaskOrThrow(taskId: TaskId): TaskWorkItem {
    const contextTask = this.mission.context.metadata?.tasks?.[taskId] as TaskWorkItem | undefined;
    if (contextTask) return contextTask;
    const fromLedger = this.getTaskFromLedger(taskId);
    if (fromLedger) return fromLedger;
    const window = this.bids.getWindow(taskId);
    if (window) {
      const synthesized: TaskWorkItem = {
        taskId,
        missionId: window.missionId,
        scenario: (window.metadata.scenario as ScenarioKind) ?? ScenarioKind.CollapsedBuilding,
        taskType: String(window.metadata.taskType ?? "generic"),
        priority: Number(window.metadata.priority ?? 0),
        location: null,
        requiredCapabilities: [],
        minTrustScore: 0.4,
        minBatteryPct: 30,
        maxDistanceM: 500,
        rescueTargetId: null,
        createdAtMs: window.openedAtMs,
        expiresAtMs: window.closesAtMs,
        metadata: { synthesized: true },
      };
      return synthesized;
    }
    throw new Error(`unknown task: ${taskId}`);
  }

  private getTaskFromLedger(taskId: TaskId): TaskWorkItem | null {
    const entries = this.ledger.byMissionId(this.missionId).filter((e) => e.kind === "task_registered" && e.payload.taskId === taskId);
    if (entries.length === 0) return null;
    const payload = entries[entries.length - 1].payload.task as TaskWorkItem | undefined;
    return payload ?? null;
  }
}

export async function taskBiddingRecoverySmokeDemo(): Promise<Record<string, unknown>> {
  const ledger = new EventLedgerStore();
  const mission: IntegratedMissionContext["mission"] = {
    phase: "search",
    phaseVersion: 4,
    context: {
      missionId: "mission-demo",
      nodes: {},
      targets: {},
      objectives: {
        totalTargetsExpected: 1,
        totalTargetsConfirmed: 1,
        totalTargetsExtracted: 1,
        minCoveragePct: 20,
        minQuorumNodes: 3,
        requiredRoles: { [NodeRole.Explorer]: 2, [NodeRole.Relay]: 1, [NodeRole.Triage]: 1 },
        safetyCritical: true,
        maxStaleNodeAgeMs: 15_000,
      },
      metadata: { tasks: {} },
    },
    setPhase(phase: MissionPhase) {
      this.phase = phase;
      this.phaseVersion += 1;
    },
    registerNode(node: NodeProfile): NodeProfile {
      this.context.nodes[node.nodeId] = node;
      return node;
    },
    upsertTarget(target: TargetRecord): TargetRecord {
      this.context.targets[target.targetId] = target;
      return target;
    },
  };

  const map = {
    snapshot(): MapSnapshot {
      return {
        mapId: "demo-map",
        version: 7,
        updatedAtMs: nowMs(),
        cells: {},
        frontierCount: 2,
        searchedCount: 8,
        blockedCount: 1,
        targetCount: 1,
        exploredCount: 9,
        dirtyCount: 0,
        coveragePct: 42,
        metadata: {},
      };
    },
    mergeSnapshot(_snapshot: MapSnapshot): { inserted: number; updated: number; ignored: number } {
      return { inserted: 0, updated: 0, ignored: 0 };
    },
    getVersion(): Version {
      return 7;
    },
    dirtyCount(): number {
      return 0;
    },
  };

  const nodeA: NodeProfile = {
    nodeId: "node-a",
    displayName: "Explorer A",
    role: NodeRole.Explorer,
    publicKey: "pub-a",
    capabilityProfile: {
      tags: ["camera", "imu", "thermal", "smoke_resistant", "outdoor"],
      sensorStack: ["camera", "thermal"],
      maxRangeM: 1200,
      maxAltitudeM: 120,
      indoorSuitability: 0.2,
      outdoorSuitability: 0.95,
      hazardClearance: ["heat", "smoke", "rapid_change"],
      notes: {},
    },
    health: { timestampMs: nowMs(), batteryPct: 88, cpuPct: 22, memoryPct: 18, linkQuality: 0.95, gpsFix: true, missionId: "mission-demo" },
    trustScore: 0.73,
    reputationScore: 0.68,
    rewardPoints: 0,
    contributionCount: 0,
    successfulTasks: 0,
    failedTasks: 0,
    lastSeenMs: nowMs(),
    firstSeenMs: nowMs(),
    location: { x: 10, y: 5, z: 0 },
    missionId: "mission-demo",
    metadata: {},
  };

  const nodeB: NodeProfile = {
    nodeId: "node-b",
    displayName: "Relay B",
    role: NodeRole.Relay,
    publicKey: "pub-b",
    capabilityProfile: {
      tags: ["relay", "long_range", "camera", "gps"],
      sensorStack: ["radio", "camera"],
      maxRangeM: 2000,
      maxAltitudeM: 120,
      indoorSuitability: 0.4,
      outdoorSuitability: 0.9,
      hazardClearance: ["heat", "smoke"],
      notes: {},
    },
    health: { timestampMs: nowMs(), batteryPct: 91, cpuPct: 18, memoryPct: 15, linkQuality: 0.98, gpsFix: true, missionId: "mission-demo" },
    trustScore: 0.82,
    reputationScore: 0.76,
    rewardPoints: 0,
    contributionCount: 0,
    successfulTasks: 0,
    failedTasks: 0,
    lastSeenMs: nowMs(),
    firstSeenMs: nowMs(),
    location: { x: 20, y: 8, z: 0 },
    missionId: "mission-demo",
    metadata: {},
  };

  const lattice: LatticeValidationAdapter = {
    getNode(nodeId: NodeId): NodeProfile | null {
      return nodeId === "node-a" ? nodeA : nodeId === "node-b" ? nodeB : null;
    },
    activeNodes(): NodeProfile[] {
      return [nodeA, nodeB];
    },
    validateBid(bid: TaskBid, node: NodeProfile, task: TaskWorkItem): { accepted: boolean; reasons: string[]; score: BidScoreBreakdown } {
      const scorer = new BidScorer();
      const score = scorer.score(task, node, bid);
      return { accepted: score.total > 25, reasons: score.reasons, score };
    },
    rankCandidates(task: TaskWorkItem, nodes: NodeProfile[]): WeightedBid[] {
      const scorer = new BidScorer();
      return nodes
        .map((node) => {
          const bid: TaskBid = {
            bidId: `bid-${node.nodeId}`,
            taskId: task.taskId,
            missionId: task.missionId,
            nodeId: node.nodeId,
            role: node.role,
            scenario: task.scenario,
            capabilityScore: 0,
            trustScore: node.trustScore,
            reputationScore: node.reputationScore,
            batteryPct: node.health.batteryPct,
            linkQuality: node.health.linkQuality,
            etaMs: 1000,
            confidence: 0.9,
            distanceM: 0,
            resources: {},
            proofHints: {},
            createdAtMs: nowMs(),
            expiresAtMs: nowMs() + 4000,
            status: TaskBidStatus.Weighted,
            metadata: {},
          };
          return {
            ...bid,
            score: scorer.score(task, node, bid),
          };
        })
        .sort((a, b) => b.score.total - a.score.total);
    },
  };

  const vertex: VertexCommitAdapter = {
    async submitOrderedAssignment(record: BidCommitRecord): Promise<{ ok: boolean; sequence: number; proofHash: string }> {
      return { ok: true, sequence: 101, proofHash: hashObject(record) };
    },
    async submitCheckpoint(record: RecoveryCheckpoint): Promise<{ ok: boolean; sequence: number; proofHash: string }> {
      return { ok: true, sequence: record.consensusSequence + 1, proofHash: record.proofHash };
    },
  };

  const rewards: RewardAdapter = {
    recordWork(payload) {
      void payload;
    },
  };

  const coordinator = new MissionExecutionCoordinator({ missionId: "mission-demo", map, mission, lattice, vertex, ledger, rewards });
  mission.registerNode(nodeA);
  mission.registerNode(nodeB);

  const task: TaskWorkItem = {
    taskId: "task-search-1",
    missionId: "mission-demo",
    scenario: ScenarioKind.Wildfire,
    taskType: "frontier_search",
    priority: 10,
    location: { x: 18, y: 7, z: 0 },
    requiredCapabilities: ["thermal", "smoke_resistant", "camera"],
    minTrustScore: 0.5,
    minBatteryPct: 40,
    maxDistanceM: 800,
    rescueTargetId: null,
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + 10000,
    metadata: { scenario: ScenarioKind.Wildfire },
  };
  mission.context.metadata.tasks = { [task.taskId]: task };

  coordinator.openBidding(task, 2, 1, 3000);
  const bidA: Omit<TaskBid, "status"> = {
    bidId: "bid-a",
    taskId: task.taskId,
    missionId: task.missionId,
    nodeId: "node-a",
    role: NodeRole.Explorer,
    scenario: ScenarioKind.Wildfire,
    capabilityScore: 0,
    trustScore: nodeA.trustScore,
    reputationScore: nodeA.reputationScore,
    batteryPct: nodeA.health.batteryPct,
    linkQuality: nodeA.health.linkQuality,
    etaMs: 850,
    confidence: 0.94,
    distanceM: 10,
    resources: { thermal: true, camera: true },
    proofHints: { sensorHash: hashObject(nodeA.capabilityProfile) },
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + 3000,
    metadata: { note: "best scouting fit" },
  };
  const bidB: Omit<TaskBid, "status"> = {
    bidId: "bid-b",
    taskId: task.taskId,
    missionId: task.missionId,
    nodeId: "node-b",
    role: NodeRole.Relay,
    scenario: ScenarioKind.Wildfire,
    capabilityScore: 0,
    trustScore: nodeB.trustScore,
    reputationScore: nodeB.reputationScore,
    batteryPct: nodeB.health.batteryPct,
    linkQuality: nodeB.health.linkQuality,
    etaMs: 1200,
    confidence: 0.9,
    distanceM: 15,
    resources: { relay: true, longRange: true },
    proofHints: { relayContinuity: true },
    createdAtMs: nowMs(),
    expiresAtMs: nowMs() + 3000,
    metadata: { note: "relay candidate" },
  };

  coordinator.submitBid(bidA);
  coordinator.submitBid(bidB);
  const commit = await coordinator.commitBids(task.taskId, "node-a", "scouting_assignment");
  const checkpoint = coordinator.createCheckpoint("node-a", "after_assignment", 101);
  const verification = coordinator.verifyCheckpoint(checkpoint, checkpoint.lastLedgerHash);
  const replay = coordinator.restoreFromLatestCheckpoint();
  const plan = coordinator.buildRecoveryPlan();
  coordinator.requestSyncFromPeers(replay.syncHints);

  return {
    task,
    bids: coordinator.listBids(task.taskId),
    weighted: coordinator.listWeightedBids(task.taskId),
    commit,
    latestCommit: coordinator.latestCommit(task.taskId),
    checkpoint,
    verification,
    replay,
    plan,
    ledgerTail: ledger.tail(20),
    ledgerVerify: ledger.verify(),
    settlementArtifact: coordinator.settlementArtifact(),
  };
}
