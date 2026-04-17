/**
 * Mission state machine + monotonic shared map for Tashi SAR backend.
 * ------------------------------------------------------------------
 * This module covers the two backend improvements requested:
 *
 * 1) a fixed mission phase machine with explicit entry/exit conditions
 * 2) a monotonic shared map that never loses knowledge under concurrent updates
 *
 * Design goals:
 * - Vertex orders phase transitions and important commits
 * - Lattice validates the resources needed for a transition
 * - Arc can later settle the final outcome / anchor the mission record
 * - map updates are monotonic and merge-safe
 * - local dirty deltas can be batched and synchronized without overwrite loss
 *
 * The code is backend-only and intentionally framework-agnostic.
 */

import { createHash, randomUUID } from "node:crypto";

import type { MissionPhase } from "./mission-phases";
import { TERMINAL_PHASES, validVertexNextPhases } from "./mission-phases";
import type { MissionNodeRole, MissionState, RosterEntry, SarTarget } from "./mission-state";
import { emptyMissionState } from "./mission-state";

export type NodeId = string;
export type MissionId = string;
export type TargetId = string;
export type EventId = string;
export type Version = number;
export type TimestampMs = number;

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

export enum CellState {
  Unknown = "unknown",
  Frontier = "frontier",
  Seen = "seen",
  Searched = "searched",
  Blocked = "blocked",
  Target = "target",
  Safe = "safe",
}

export enum TransitionReason {
  Boot = "boot",
  QuorumReached = "quorum_reached",
  CoverageReached = "coverage_reached",
  TargetConfirmed = "target_confirmed",
  TargetAssigned = "target_assigned",
  ContactMade = "contact_made",
  ObjectiveComplete = "objective_complete",
  SafetyDegraded = "safety_degraded",
  ManualAbort = "manual_abort",
  OperatorOverride = "operator_override",
}

export interface XYPoint {
  x: number;
  y: number;
  z?: number;
}

export interface NodeStatus {
  nodeId: NodeId;
  role: NodeRole;
  batteryPct: number;
  linkQuality: number;
  gpsFix: boolean;
  lastSeenMs: TimestampMs;
  active: boolean;
  capabilities: string[];
  missionId?: MissionId | null;
  location?: XYPoint | null;
}

export interface TargetRecord {
  targetId: TargetId;
  missionId: MissionId;
  targetType: string;
  confidence: number;
  position?: XYPoint | null;
  confirmedBy: NodeId[];
  assignedTo?: NodeId | null;
  extractedBy?: NodeId | null;
  foundAtMs: TimestampMs;
  confirmedAtMs?: TimestampMs | null;
  assignedAtMs?: TimestampMs | null;
  extractedAtMs?: TimestampMs | null;
  status: "new" | "confirmed" | "assigned" | "extracted" | "lost";
  metadata: Record<string, unknown>;
}

export interface MissionObjectives {
  totalTargetsExpected: number;
  totalTargetsConfirmed: number;
  totalTargetsExtracted: number;
  minCoveragePct: number;
  minQuorumNodes: number;
  requiredRoles: Partial<Record<NodeRole, number>>;
  safetyCritical: boolean;
  maxStaleNodeAgeMs: number;
}

export interface MissionSnapshot {
  missionId: MissionId;
  phase: MissionPhase;
  phaseVersion: Version;
  updatedAtMs: TimestampMs;
  nodes: Record<NodeId, NodeStatus>;
  targets: Record<TargetId, TargetRecord>;
  coveragePct: number;
  healthyNodeCount: number;
  staleNodeCount: number;
  blockedCells: number;
  searchCells: number;
  discoveredCells: number;
  completedTargets: number;
  objectives: MissionObjectives;
  metadata: Record<string, unknown>;
}

export interface PhaseTransitionRecord {
  transitionId: EventId;
  missionId: MissionId;
  from: MissionPhase;
  to: MissionPhase;
  reason: TransitionReason;
  requestedBy: NodeId;
  createdAtMs: TimestampMs;
  version: Version;
  entryChecks: Record<string, unknown>;
  exitChecks: Record<string, unknown>;
  accepted: boolean;
  rejectedReason?: string | null;
  proofHash: string;
}

export interface MapCell {
  cellId: string;
  x: number;
  y: number;
  z: number;
  state: CellState;
  confidence: number;
  owner?: NodeId | null;
  cost: number;
  lastSeenMs: TimestampMs;
  version: Version;
  confirmedBy: NodeId[];
  metadata: Record<string, unknown>;
}

export interface MapDelta {
  deltaId: string;
  mapId: string;
  baseVersion: Version;
  createdAtMs: TimestampMs;
  sourceNodeId: NodeId;
  cells: MapCell[];
  reason: string;
  metadata: Record<string, unknown>;
}

export interface MapSnapshot {
  mapId: string;
  version: Version;
  updatedAtMs: TimestampMs;
  cells: Record<string, MapCell>;
  frontierCount: number;
  searchedCount: number;
  blockedCount: number;
  targetCount: number;
  exploredCount: number;
  dirtyCount: number;
  coveragePct: number;
  metadata: Record<string, unknown>;
}

export interface PhaseCommitAdapter {
  commitPhaseTransition(record: PhaseTransitionRecord): void;
  commitMapSnapshot(snapshot: MapSnapshot): void;
  commitMapDelta(delta: MapDelta): void;
  commitTarget?(target: TargetRecord): void;
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

function cellId(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

export function manhattanDistance(a: XYPoint, b: XYPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs((a.z ?? 0) - (b.z ?? 0));
}

function newEventId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** Map detailed SAR roles onto the slimmer ``MissionState`` roster contract. */
export function nodeRoleToMissionNodeRole(role: NodeRole): MissionNodeRole {
  switch (role) {
    case NodeRole.Relay:
      return "relay";
    case NodeRole.Transport:
      return "carrier";
    case NodeRole.Triage:
    case NodeRole.Rescuer:
    case NodeRole.Emergency:
      return "medic";
    case NodeRole.Sensor:
    case NodeRole.Command:
    case NodeRole.Standby:
      return "observer";
    case NodeRole.Explorer:
    default:
      return "explorer";
  }
}

/**
 * Projects the state machine + monotonic map into the canonical ``MissionState`` read model
 * used by ``buildTashiStateEnvelope`` / snapshot bridge.
 */
export function missionStateFromMachine(machine: MissionStateMachine, nowMsOverride?: number): MissionState {
  const snap = machine.snapshot();
  const t = nowMsOverride ?? nowMs();
  const base = emptyMissionState(snap.missionId, t);
  const roster: Record<string, RosterEntry> = {};
  for (const n of Object.values(snap.nodes)) {
    roster[n.nodeId] = {
      nodeId: n.nodeId,
      role: nodeRoleToMissionNodeRole(n.role),
      joinedAtMs: n.lastSeenMs,
      capabilities: n.capabilities,
    };
  }
  const targets: Record<string, SarTarget> = {};
  for (const tgt of Object.values(snap.targets)) {
    targets[tgt.targetId] = {
      targetId: tgt.targetId,
      discoveredBy: tgt.confirmedBy[0],
      confirmedByVertex: tgt.status !== "new" && tgt.status !== "lost",
      notes: typeof tgt.metadata.note === "string" ? tgt.metadata.note : undefined,
    };
  }
  const mapS = machine.map.snapshot();
  const headHash = machine.context.latestTransition?.proofHash ?? base.consensusPointer.lastEventHash;
  return {
    ...base,
    phase: snap.phase,
    updatedAtMs: t,
    roster,
    targets,
    mapSummary: {
      cellsKnown: Object.keys(mapS.cells).length,
      lastMergedVersion: mapS.version,
    },
    consensusPointer: {
      sequence: snap.phaseVersion,
      lastEventHash: headHash,
    },
  };
}

// ---------------------------------------------------------------------------
// Monotonic map: unknown -> seen -> searched, with blocked/target as terminal
// meaning. Updates only move forward unless a stronger terminal fact arrives.
// ---------------------------------------------------------------------------

export class MonotonicSharedMap {
  private readonly cells = new Map<string, MapCell>();
  private readonly dirty = new Set<string>();
  private version: Version = 0;

  constructor(public readonly mapId: string) {}

  getVersion(): Version {
    return this.version;
  }

  private bump(): Version {
    this.version += 1;
    return this.version;
  }

  private markDirty(id: string): void {
    this.dirty.add(id);
  }

  private stateRank(state: CellState): number {
    switch (state) {
      case CellState.Unknown:
        return 0;
      case CellState.Frontier:
        return 1;
      case CellState.Seen:
        return 2;
      case CellState.Searched:
        return 3;
      case CellState.Safe:
        return 4;
      case CellState.Target:
        return 5;
      case CellState.Blocked:
        return 6;
      default:
        return 0;
    }
  }

  private mergeState(current: CellState, incoming: CellState): CellState {
    const currentRank = this.stateRank(current);
    const incomingRank = this.stateRank(incoming);
    if (incomingRank >= currentRank) return incoming;

    // Allow a terminal high-confidence fact to preserve semantic meaning.
    if (incoming === CellState.Target && current !== CellState.Blocked) return incoming;
    if (incoming === CellState.Blocked && current !== CellState.Target) return incoming;
    return current;
  }

  private normalizeCell(cell: MapCell): MapCell {
    return {
      ...cell,
      confidence: clamp(cell.confidence, 0, 1),
      cost: Math.max(0, cell.cost),
      confirmedBy: [...new Set(cell.confirmedBy)],
      metadata: { ...(cell.metadata ?? {}) },
    };
  }

  private currentOrCreate(x: number, y: number, z = 0): MapCell {
    const id = cellId(x, y, z);
    const current = this.cells.get(id);
    if (current) return current;
    const created: MapCell = {
      cellId: id,
      x,
      y,
      z,
      state: CellState.Unknown,
      confidence: 0,
      owner: null,
      cost: 1,
      lastSeenMs: nowMs(),
      version: 0,
      confirmedBy: [],
      metadata: {},
    };
    this.cells.set(id, created);
    return created;
  }

  upsert(cell: MapCell, _sourceNodeId = "local"): MapCell {
    const current = this.cells.get(cell.cellId);
    const incoming = this.normalizeCell(cell);
    const next: MapCell = current ? this.resolve(current, incoming) : incoming;
    this.cells.set(next.cellId, next);
    this.markDirty(next.cellId);
    this.bump();
    return next;
  }

  markSeen(x: number, y: number, z = 0, owner?: NodeId | null, confidence = 0.6, metadata: Record<string, unknown> = {}): MapCell {
    const id = cellId(x, y, z);
    const current = this.currentOrCreate(x, y, z);
    const next: MapCell = {
      ...current,
      state: this.mergeState(current.state, CellState.Seen),
      owner: owner ?? current.owner ?? null,
      confidence: Math.max(current.confidence, confidence),
      lastSeenMs: nowMs(),
      version: current.version + 1,
      metadata: { ...(current.metadata ?? {}), ...metadata },
    };
    this.cells.set(id, next);
    this.markDirty(id);
    this.bump();
    return next;
  }

  markFrontier(x: number, y: number, z = 0, owner?: NodeId | null): MapCell {
    const id = cellId(x, y, z);
    const current = this.currentOrCreate(x, y, z);
    const next: MapCell = {
      ...current,
      state: this.mergeState(current.state, CellState.Frontier),
      owner: owner ?? current.owner ?? null,
      confidence: Math.max(current.confidence, 0.35),
      lastSeenMs: nowMs(),
      version: current.version + 1,
      metadata: { ...(current.metadata ?? {}), frontier: true },
    };
    this.cells.set(id, next);
    this.markDirty(id);
    this.bump();
    return next;
  }

  markSearched(x: number, y: number, z = 0, owner?: NodeId | null, confidence = 0.9): MapCell {
    const id = cellId(x, y, z);
    const current = this.currentOrCreate(x, y, z);
    const next: MapCell = {
      ...current,
      state: this.mergeState(current.state, CellState.Searched),
      owner: owner ?? current.owner ?? null,
      confidence: Math.max(current.confidence, confidence),
      lastSeenMs: nowMs(),
      version: current.version + 1,
      metadata: { ...(current.metadata ?? {}), searched: true },
    };
    this.cells.set(id, next);
    this.markDirty(id);
    this.bump();
    return next;
  }

  markBlocked(x: number, y: number, z = 0, owner?: NodeId | null, reason = ""): MapCell {
    const id = cellId(x, y, z);
    const current = this.currentOrCreate(x, y, z);
    const next: MapCell = {
      ...current,
      state: this.mergeState(current.state, CellState.Blocked),
      owner: owner ?? current.owner ?? null,
      confidence: Math.max(current.confidence, 1),
      lastSeenMs: nowMs(),
      version: current.version + 1,
      metadata: { ...(current.metadata ?? {}), blocked: true, reason },
    };
    this.cells.set(id, next);
    this.markDirty(id);
    this.bump();
    return next;
  }

  markTarget(x: number, y: number, z = 0, owner?: NodeId | null, targetType = "victim", confidence = 1.0): MapCell {
    const id = cellId(x, y, z);
    const current = this.currentOrCreate(x, y, z);
    const next: MapCell = {
      ...current,
      state: this.mergeState(current.state, CellState.Target),
      owner: owner ?? current.owner ?? null,
      confidence: Math.max(current.confidence, confidence),
      lastSeenMs: nowMs(),
      version: current.version + 1,
      metadata: { ...(current.metadata ?? {}), targetType },
    };
    this.cells.set(id, next);
    this.markDirty(id);
    this.bump();
    return next;
  }

  markSafe(x: number, y: number, z = 0, owner?: NodeId | null): MapCell {
    const id = cellId(x, y, z);
    const current = this.currentOrCreate(x, y, z);
    const next: MapCell = {
      ...current,
      state: this.mergeState(current.state, CellState.Safe),
      owner: owner ?? current.owner ?? null,
      confidence: Math.max(current.confidence, 0.75),
      lastSeenMs: nowMs(),
      version: current.version + 1,
      metadata: { ...(current.metadata ?? {}), safe: true },
    };
    this.cells.set(id, next);
    this.markDirty(id);
    this.bump();
    return next;
  }

  private resolve(current: MapCell, incoming: MapCell): MapCell {
    const nextState =
      incoming.version > current.version
        ? this.mergeState(current.state, incoming.state)
        : incoming.version === current.version && incoming.lastSeenMs >= current.lastSeenMs
          ? this.mergeState(current.state, incoming.state)
          : current.state;

    const nextConfidence = Math.max(current.confidence, incoming.confidence);
    const nextCost = Math.min(current.cost, incoming.cost || current.cost);
    const nextOwner = incoming.owner ?? current.owner ?? null;
    const nextConfirmedBy = [...new Set([...(current.confirmedBy ?? []), ...(incoming.confirmedBy ?? [])])];
    const nextMetadata = { ...(current.metadata ?? {}), ...(incoming.metadata ?? {}) };

    const merged: MapCell = {
      ...current,
      state: nextState,
      confidence: nextConfidence,
      owner: nextOwner,
      cost: nextCost,
      lastSeenMs: Math.max(current.lastSeenMs, incoming.lastSeenMs),
      version: Math.max(current.version, incoming.version),
      confirmedBy: nextConfirmedBy,
      metadata: nextMetadata,
    };

    const unchanged =
      merged.state === current.state &&
      merged.confidence === current.confidence &&
      merged.owner === current.owner &&
      merged.cost === current.cost &&
      merged.lastSeenMs === current.lastSeenMs &&
      merged.version === current.version &&
      stableStringify(merged.metadata) === stableStringify(current.metadata) &&
      stableStringify(merged.confirmedBy) === stableStringify(current.confirmedBy);

    return unchanged ? current : { ...merged, version: merged.version + 1 };
  }

  merge(
    remoteCells: MapCell[],
    sourceVersion = 0,
    _sourceNodeId = "remote",
  ): { inserted: number; updated: number; ignored: number } {
    const stats = { inserted: 0, updated: 0, ignored: 0 };

    for (const remote of remoteCells) {
      const current = this.cells.get(remote.cellId);
      const normalized = this.normalizeCell(remote);
      if (!current) {
        this.cells.set(normalized.cellId, normalized);
        this.markDirty(normalized.cellId);
        stats.inserted += 1;
        continue;
      }

      const resolved = this.resolve(current, normalized);
      const changed =
        resolved.state !== current.state ||
        resolved.confidence !== current.confidence ||
        resolved.owner !== current.owner ||
        resolved.cost !== current.cost ||
        resolved.lastSeenMs !== current.lastSeenMs ||
        resolved.version !== current.version ||
        stableStringify(resolved.metadata) !== stableStringify(current.metadata) ||
        stableStringify(resolved.confirmedBy) !== stableStringify(current.confirmedBy);

      if (changed) {
        this.cells.set(resolved.cellId, resolved);
        this.markDirty(resolved.cellId);
        stats.updated += 1;
      } else {
        stats.ignored += 1;
      }
    }

    if (sourceVersion > this.version) {
      this.version = sourceVersion;
    }
    if (stats.inserted + stats.updated > 0) {
      this.bump();
    }

    return stats;
  }

  mergeSnapshot(snapshot: MapSnapshot, sourceNodeId = "remote"): { inserted: number; updated: number; ignored: number } {
    return this.merge(Object.values(snapshot.cells), snapshot.version, sourceNodeId);
  }

  snapshot(): MapSnapshot {
    const cells = Object.fromEntries([...this.cells.entries()].map(([id, cell]) => [id, { ...cell }]));
    const frontierCount = Object.values(cells).filter((c) => c.state === CellState.Frontier).length;
    const searchedCount = Object.values(cells).filter((c) => c.state === CellState.Searched).length;
    const blockedCount = Object.values(cells).filter((c) => c.state === CellState.Blocked).length;
    const targetCount = Object.values(cells).filter((c) => c.state === CellState.Target).length;
    const exploredCount = Object.values(cells).filter((c) =>
      [CellState.Seen, CellState.Searched, CellState.Target, CellState.Blocked, CellState.Safe].includes(c.state),
    ).length;
    const totalKnown = Object.keys(cells).length;
    return {
      mapId: this.mapId,
      version: this.version,
      updatedAtMs: nowMs(),
      cells,
      frontierCount,
      searchedCount,
      blockedCount,
      targetCount,
      exploredCount,
      dirtyCount: this.dirty.size,
      coveragePct: totalKnown > 0 ? round2((exploredCount / totalKnown) * 100) : 0,
      metadata: { dirty: this.dirty.size },
    };
  }

  delta(maxCells = 200, reason = "dirty_sync", sourceNodeId = "local"): MapDelta {
    const baseVersion = this.version;
    const dirtyIds = [...this.dirty].slice(0, maxCells);
    for (const id of dirtyIds) {
      this.dirty.delete(id);
    }
    const cells = dirtyIds.map((id) => this.cells.get(id)).filter(Boolean) as MapCell[];
    const remainingDirty = this.dirty.size;
    return {
      deltaId: newEventId("delta"),
      mapId: this.mapId,
      baseVersion,
      createdAtMs: nowMs(),
      sourceNodeId,
      cells,
      reason,
      metadata: { remainingDirty, flushed: dirtyIds.length, maxCells },
    };
  }

  isDirty(): boolean {
    return this.dirty.size > 0;
  }

  dirtyCount(): number {
    return this.dirty.size;
  }

  cell(id: string): MapCell | null {
    return this.cells.get(id) ?? null;
  }

  allCells(): MapCell[] {
    return [...this.cells.values()];
  }

  frontierCells(): MapCell[] {
    return this.allCells().filter((cell) => cell.state === CellState.Frontier);
  }

  exploredCells(): MapCell[] {
    return this.allCells().filter((cell) =>
      [CellState.Seen, CellState.Searched, CellState.Target, CellState.Blocked, CellState.Safe].includes(cell.state),
    );
  }

  summary(): Record<string, unknown> {
    const snap = this.snapshot();
    return {
      mapId: snap.mapId,
      version: snap.version,
      cells: Object.keys(snap.cells).length,
      frontierCount: snap.frontierCount,
      searchedCount: snap.searchedCount,
      blockedCount: snap.blockedCount,
      targetCount: snap.targetCount,
      exploredCount: snap.exploredCount,
      dirtyCount: snap.dirtyCount,
      coveragePct: snap.coveragePct,
    };
  }
}

// ---------------------------------------------------------------------------
// Mission state machine
// ---------------------------------------------------------------------------

export interface MissionStateContext {
  missionId: MissionId;
  createdAtMs: TimestampMs;
  updatedAtMs: TimestampMs;
  phase: MissionPhase;
  phaseVersion: Version;
  nodes: Record<NodeId, NodeStatus>;
  targets: Record<TargetId, TargetRecord>;
  map: MonotonicSharedMap;
  objectives: MissionObjectives;
  metadata: Record<string, unknown>;
  latestTransition?: PhaseTransitionRecord | null;
  notes?: string[];
}

export interface PhaseEntryExitChecks {
  entry: Record<string, unknown>;
  exit: Record<string, unknown>;
}

export interface MissionStateMachineDeps {
  /**
   * Vertex should use these records to order the transitions.
   * This module does not implement Vertex itself; it emits transition records
   * that are ready to be committed.
   */
  commitTransition?: (record: PhaseTransitionRecord) => void;
  commitSnapshot?: (snapshot: MissionSnapshot) => void;
  commitDelta?: (delta: MapDelta) => void;
  /** Target lifecycle signals for Lattice — not the same as a Vertex phase commit. */
  commitTarget?: (target: TargetRecord) => void;
}

export class MissionStateMachine {
  private readonly ctx: MissionStateContext;
  private readonly transitions: PhaseTransitionRecord[] = [];
  private readonly deps: MissionStateMachineDeps;
  private readonly eventLog: Array<{ tsMs: TimestampMs; type: string; payload: Record<string, unknown> }> = [];

  constructor(
    missionId: MissionId,
    map: MonotonicSharedMap,
    objectives: Partial<MissionObjectives> = {},
    deps: MissionStateMachineDeps = {},
    metadata: Record<string, unknown> = {},
  ) {
    this.ctx = {
      missionId,
      createdAtMs: nowMs(),
      updatedAtMs: nowMs(),
      phase: "init",
      phaseVersion: 0,
      nodes: {},
      targets: {},
      map,
      objectives: {
        totalTargetsExpected: objectives.totalTargetsExpected ?? 0,
        totalTargetsConfirmed: objectives.totalTargetsConfirmed ?? 0,
        totalTargetsExtracted: objectives.totalTargetsExtracted ?? 0,
        minCoveragePct: objectives.minCoveragePct ?? 0,
        minQuorumNodes: objectives.minQuorumNodes ?? 3,
        requiredRoles: objectives.requiredRoles ?? {},
        safetyCritical: objectives.safetyCritical ?? true,
        maxStaleNodeAgeMs: objectives.maxStaleNodeAgeMs ?? 15_000,
      },
      metadata,
      latestTransition: null,
      notes: [],
    };
    this.deps = deps;
    this.recordEvent("mission_init", { missionId });
  }

  get context(): MissionStateContext {
    return this.ctx;
  }

  get phase(): MissionPhase {
    return this.ctx.phase;
  }

  get phaseVersion(): Version {
    return this.ctx.phaseVersion;
  }

  get map(): MonotonicSharedMap {
    return this.ctx.map;
  }

  getNode(nodeId: NodeId): NodeStatus | null {
    return this.ctx.nodes[nodeId] ?? null;
  }

  getTarget(targetId: TargetId): TargetRecord | null {
    return this.ctx.targets[targetId] ?? null;
  }

  listNodes(): NodeStatus[] {
    return Object.values(this.ctx.nodes);
  }

  listTargets(): TargetRecord[] {
    return Object.values(this.ctx.targets);
  }

  listTransitions(): PhaseTransitionRecord[] {
    return [...this.transitions];
  }

  listEvents(limit = 200): Array<{ tsMs: TimestampMs; type: string; payload: Record<string, unknown> }> {
    return this.eventLog.slice(-limit);
  }

  snapshot(): MissionSnapshot {
    const nodes = this.ctx.nodes;
    const targets = this.ctx.targets;
    const mapSnap = this.ctx.map.snapshot();
    const values = Object.values(nodes);
    const healthyNodeCount = values.filter((n) => n.active && n.batteryPct > 15 && n.linkQuality > 0.2).length;
    const staleNodeCount = values.filter((n) => nowMs() - n.lastSeenMs > this.ctx.objectives.maxStaleNodeAgeMs).length;
    const completedTargets = Object.values(targets).filter((t) => t.status === "extracted").length;
    return {
      missionId: this.ctx.missionId,
      phase: this.ctx.phase,
      phaseVersion: this.ctx.phaseVersion,
      updatedAtMs: nowMs(),
      nodes,
      targets,
      coveragePct: Number(mapSnap.coveragePct),
      healthyNodeCount,
      staleNodeCount,
      blockedCells: mapSnap.blockedCount,
      searchCells: mapSnap.searchedCount,
      discoveredCells: mapSnap.exploredCount,
      completedTargets,
      objectives: this.ctx.objectives,
      metadata: {
        ...this.ctx.metadata,
        dirtyMap: this.ctx.map.dirtyCount(),
        latestTransitionId: this.ctx.latestTransition?.transitionId ?? null,
      },
    };
  }

  registerNode(node: NodeStatus): NodeStatus {
    const current = this.ctx.nodes[node.nodeId];
    const next: NodeStatus = {
      ...node,
      batteryPct: clamp(node.batteryPct, 0, 100),
      linkQuality: clamp(node.linkQuality, 0, 1),
      active: node.active !== false,
      lastSeenMs: node.lastSeenMs || nowMs(),
      missionId: node.missionId ?? this.ctx.missionId,
      capabilities: [...new Set(node.capabilities ?? [])],
    };
    this.ctx.nodes[node.nodeId] = current ? this.mergeNode(current, next) : next;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("node_register", { nodeId: node.nodeId, role: node.role, active: next.active });
    return this.ctx.nodes[node.nodeId];
  }

  updateNode(nodeId: NodeId, patch: Partial<NodeStatus>): NodeStatus | null {
    const current = this.ctx.nodes[nodeId];
    if (!current) return null;
    const next: NodeStatus = {
      ...current,
      ...patch,
      batteryPct: clamp(patch.batteryPct ?? current.batteryPct, 0, 100),
      linkQuality: clamp(patch.linkQuality ?? current.linkQuality, 0, 1),
      gpsFix: patch.gpsFix ?? current.gpsFix,
      active: patch.active ?? current.active,
      lastSeenMs: patch.lastSeenMs ?? nowMs(),
      missionId: patch.missionId ?? current.missionId,
      capabilities: [...new Set(patch.capabilities ?? current.capabilities)],
    };
    this.ctx.nodes[nodeId] = this.mergeNode(current, next);
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("node_update", { nodeId, patch });
    return this.ctx.nodes[nodeId];
  }

  removeNode(nodeId: NodeId): boolean {
    if (!this.ctx.nodes[nodeId]) return false;
    delete this.ctx.nodes[nodeId];
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("node_remove", { nodeId });
    return true;
  }

  upsertTarget(target: TargetRecord): TargetRecord {
    const current = this.ctx.targets[target.targetId];
    const next = current ? this.mergeTarget(current, target) : target;
    this.ctx.targets[target.targetId] = next;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("target_upsert", { targetId: target.targetId, status: next.status, missionId: next.missionId });
    this.deps.commitTarget?.(next);
    this.deps.commitSnapshot?.(this.snapshot());
    return next;
  }

  confirmTarget(targetId: TargetId, nodeId: NodeId, proof: Record<string, unknown> = {}): TargetRecord | null {
    const current = this.ctx.targets[targetId];
    if (!current) return null;
    const next: TargetRecord = {
      ...current,
      status: "confirmed",
      confidence: Math.max(current.confidence, Number(proof.confidence ?? current.confidence)),
      confirmedBy: [...new Set([...current.confirmedBy, nodeId])],
      confirmedAtMs: current.confirmedAtMs ?? nowMs(),
      metadata: { ...(current.metadata ?? {}), ...proof },
    };
    this.ctx.targets[targetId] = next;
    this.ctx.objectives.totalTargetsConfirmed += current.status === "confirmed" ? 0 : 1;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("target_confirm", { targetId, nodeId });
    this.deps.commitTarget?.(next);
    this.deps.commitSnapshot?.(this.snapshot());
    return next;
  }

  assignTarget(targetId: TargetId, nodeId: NodeId, reason = ""): TargetRecord | null {
    const current = this.ctx.targets[targetId];
    if (!current) return null;
    const next: TargetRecord = {
      ...current,
      status: "assigned",
      assignedTo: nodeId,
      assignedAtMs: nowMs(),
      metadata: { ...(current.metadata ?? {}), assignmentReason: reason },
    };
    this.ctx.targets[targetId] = next;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("target_assign", { targetId, nodeId, reason });
    this.deps.commitTarget?.(next);
    this.deps.commitSnapshot?.(this.snapshot());
    return next;
  }

  extractTarget(targetId: TargetId, nodeId: NodeId, proof: Record<string, unknown> = {}): TargetRecord | null {
    const current = this.ctx.targets[targetId];
    if (!current) return null;
    const next: TargetRecord = {
      ...current,
      status: "extracted",
      extractedBy: nodeId,
      extractedAtMs: nowMs(),
      metadata: { ...(current.metadata ?? {}), ...proof },
    };
    this.ctx.targets[targetId] = next;
    this.ctx.objectives.totalTargetsExtracted += current.status === "extracted" ? 0 : 1;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("target_extract", { targetId, nodeId });
    this.deps.commitTarget?.(next);
    this.deps.commitSnapshot?.(this.snapshot());
    return next;
  }

  setNodeLocation(nodeId: NodeId, location: XYPoint): NodeStatus | null {
    const current = this.ctx.nodes[nodeId];
    if (!current) return null;
    current.location = { ...location };
    current.lastSeenMs = nowMs();
    this.ctx.nodes[nodeId] = current;
    this.recordEvent("node_location", { nodeId, location });
    return current;
  }

  canTransition(to: MissionPhase): { ok: boolean; reason: string; checks: PhaseEntryExitChecks } {
    const checks = this.computeChecks(to);
    const entryOk = Object.values(checks.entry).every((v) => v !== false);
    const exitOk = Object.values(checks.exit).every((v) => v !== false);
    if (!entryOk) return { ok: false, reason: `entry_failed:${JSON.stringify(checks.entry)}`, checks };
    if (!exitOk) return { ok: false, reason: `exit_failed:${JSON.stringify(checks.exit)}`, checks };
    return { ok: true, reason: "ok", checks };
  }

  transition(to: MissionPhase, requestedBy: NodeId, reason: TransitionReason): PhaseTransitionRecord {
    const from = this.ctx.phase;
    const checks = this.computeChecks(to);
    const evaluation = this.evaluateTransition(from, to, checks);
    const transition: PhaseTransitionRecord = {
      transitionId: newEventId("tx"),
      missionId: this.ctx.missionId,
      from,
      to,
      reason,
      requestedBy,
      createdAtMs: nowMs(),
      version: this.ctx.phaseVersion + 1,
      entryChecks: checks.entry,
      exitChecks: checks.exit,
      accepted: evaluation.ok,
      rejectedReason: evaluation.ok ? null : evaluation.reason,
      proofHash: hashObject({ missionId: this.ctx.missionId, from, to, reason, checks, requestedBy, version: this.ctx.phaseVersion + 1 }),
    };

    this.transitions.push(transition);
    this.ctx.latestTransition = transition;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("phase_transition_request", { from, to, reason, requestedBy });

    if (!transition.accepted) {
      this.recordEvent("phase_transition_reject", { from, to, reason: transition.rejectedReason });
      this.deps.commitTransition?.(transition);
      return transition;
    }

    this.ctx.phase = to;
    this.ctx.phaseVersion += 1;
    this.recordEvent("phase_transition_commit", { from, to, reason, requestedBy, phaseVersion: this.ctx.phaseVersion });
    this.deps.commitTransition?.(transition);
    this.deps.commitSnapshot?.(this.snapshot());
    return transition;
  }

  forceAbort(requestedBy: NodeId, reason: TransitionReason = TransitionReason.ManualAbort, details: Record<string, unknown> = {}): PhaseTransitionRecord {
    const from = this.ctx.phase;
    const transition: PhaseTransitionRecord = {
      transitionId: newEventId("abort"),
      missionId: this.ctx.missionId,
      from,
      to: "aborted",
      reason,
      requestedBy,
      createdAtMs: nowMs(),
      version: this.ctx.phaseVersion + 1,
      entryChecks: { forced: true, ...details },
      exitChecks: {},
      accepted: true,
      rejectedReason: null,
      proofHash: hashObject({ missionId: this.ctx.missionId, from, to: "aborted", reason, details, requestedBy }),
    };
    this.transitions.push(transition);
    this.ctx.latestTransition = transition;
    this.ctx.phase = "aborted";
    this.ctx.phaseVersion += 1;
    this.ctx.updatedAtMs = nowMs();
    this.recordEvent("phase_force_abort", { from, requestedBy, reason, details });
    this.deps.commitTransition?.(transition);
    this.deps.commitSnapshot?.(this.snapshot());
    return transition;
  }

  advanceIfReady(requestedBy: NodeId): PhaseTransitionRecord | null {
    const next = this.suggestNextPhase();
    if (!next || next === this.ctx.phase) return null;
    const tx = this.transition(next, requestedBy, this.reasonFor(next));
    return tx.accepted ? tx : null;
  }

  suggestNextPhase(): MissionPhase | null {
    switch (this.ctx.phase) {
      case "init":
        return this.entryPhaseAfterInit();
      case "discovery":
        return this.entryPhaseAfterDiscovery();
      case "search":
        return this.entryPhaseAfterSearch();
      case "triage":
        return this.entryPhaseAfterTriage();
      case "rescue":
        return this.entryPhaseAfterRescue();
      case "extraction":
        return this.entryPhaseAfterExtraction();
      case "return":
        return this.entryPhaseAfterReturn();
      default:
        return null;
    }
  }

  private computeChecks(to: MissionPhase): PhaseEntryExitChecks {
    const nodes = Object.values(this.ctx.nodes);
    const activeNodes = nodes.filter((n) => n.active && n.batteryPct > 15 && n.linkQuality > 0.2);
    const healthyNodes = nodes.filter(
      (n) => n.active && n.batteryPct > 20 && n.linkQuality > 0.3 && nowMs() - n.lastSeenMs <= this.ctx.objectives.maxStaleNodeAgeMs,
    );
    const staleNodes = nodes.filter((n) => nowMs() - n.lastSeenMs > this.ctx.objectives.maxStaleNodeAgeMs);
    const targets = Object.values(this.ctx.targets);
    const confirmedTargets = targets.filter((t) => t.status === "confirmed" || t.status === "assigned" || t.status === "extracted");
    const assignedTargets = targets.filter((t) => t.status === "assigned" || t.status === "extracted");
    const extractedTargets = targets.filter((t) => t.status === "extracted");
    const mapSnap = this.ctx.map.snapshot();

    const roleCounts = this.countRoles(nodes);
    const quorum = Math.max(this.ctx.objectives.minQuorumNodes, 1);

    const entry: Record<string, unknown> = {};
    const exit: Record<string, unknown> = {};

    if (to === "discovery") {
      const rollbackFromSearch = this.ctx.phase === "search";
      entry.quorumReached = activeNodes.length >= quorum;
      entry.requiredRolesSatisfied = this.requiredRolesSatisfied(roleCounts);
      // Fresh discovery vs Vertex-allowed rollback from search (coverage may already be high).
      entry.coverageNotTooHigh = rollbackFromSearch || mapSnap.coveragePct < 30;
      exit.discoveryProgress = mapSnap.exploredCount > 0 || Object.keys(this.ctx.nodes).length >= quorum;
    }

    if (to === "search") {
      entry.quorumReached = activeNodes.length >= quorum;
      entry.coverageReached = mapSnap.coveragePct >= this.ctx.objectives.minCoveragePct;
      entry.relayAvailable = roleCounts[NodeRole.Relay] !== undefined;
      exit.searchProgress = mapSnap.searchedCount > 0 || mapSnap.exploredCount > 0;
    }

    if (to === "triage") {
      entry.atLeastOneTargetConfirmed = confirmedTargets.length >= 1;
      entry.triageNodesAvailable = (roleCounts[NodeRole.Triage] ?? 0) > 0 || (roleCounts[NodeRole.Rescuer] ?? 0) > 0;
      entry.coverageSufficient = mapSnap.coveragePct >= this.ctx.objectives.minCoveragePct * 0.5;
      exit.triageBacklogCleared = confirmedTargets.length >= 1;
    }

    if (to === "rescue") {
      entry.atLeastOneTargetAssigned = assignedTargets.length >= 1;
      entry.rescuersAvailable = (roleCounts[NodeRole.Rescuer] ?? 0) > 0 || (roleCounts[NodeRole.Transport] ?? 0) > 0;
      entry.safetyNotCritical = !this.ctx.objectives.safetyCritical || healthyNodes.length >= 1;
      exit.rescueInProgress = assignedTargets.length >= 1;
    }

    if (to === "extraction") {
      entry.rescuerContactMade = assignedTargets.length >= 1;
      entry.extractionTeamAvailable = (roleCounts[NodeRole.Rescuer] ?? 0) > 0;
      entry.targetInContact = assignedTargets.some((t) => !!t.position || t.status === "assigned");
      exit.extractionProgress = extractedTargets.length >= 1;
    }

    if (to === "return") {
      entry.objectivesComplete = this.areObjectivesComplete();
      entry.noOpenExtraction = assignedTargets.length === 0 || extractedTargets.length >= assignedTargets.length;
      exit.returnTriggered = true;
      exit.safetySnapshot = { staleNodes: staleNodes.length, healthyNodes: healthyNodes.length };
    }

    if (to === "complete") {
      entry.objectivesComplete = this.areObjectivesComplete();
      entry.returnReady = this.ctx.phase === "return" || this.areObjectivesComplete();
      exit.finalized = true;
    }

    if (to === "aborted") {
      entry.manualAbort = true;
      exit.finalized = true;
    }

    return { entry, exit };
  }

  private evaluateTransition(from: MissionPhase, to: MissionPhase, checks: PhaseEntryExitChecks): { ok: boolean; reason: string } {
    const allowed = this.allowedTransitions(from);
    if (to !== "aborted" && !allowed.includes(to)) {
      return { ok: false, reason: `illegal_transition:${from}->${to}` };
    }

    const ok =
      Object.values(checks.entry).every((value) => value !== false) && Object.values(checks.exit).every((value) => value !== false);
    if (!ok) {
      return { ok: false, reason: `checks_failed:${from}->${to}` };
    }
    return { ok: true, reason: "ok" };
  }

  /**
   * Allowed next phases = Vertex contract (``validVertexNextPhases``) plus local
   * early-return shortcuts that still require entry/exit checks to pass.
   */
  private static readonly EARLY_RETURN_EXTRAS: Partial<Record<MissionPhase, readonly MissionPhase[]>> = {
    search: ["return"],
    triage: ["return"],
    rescue: ["return"],
    extraction: ["return"],
  };

  private allowedTransitions(from: MissionPhase): MissionPhase[] {
    if (TERMINAL_PHASES.has(from)) return [];
    const vertex = validVertexNextPhases(from);
    const extras = MissionStateMachine.EARLY_RETURN_EXTRAS[from] ?? [];
    return [...new Set<MissionPhase>([...vertex, ...extras])];
  }

  private entryPhaseAfterInit(): MissionPhase | null {
    return this.canEnterDiscovery() ? "discovery" : null;
  }

  private entryPhaseAfterDiscovery(): MissionPhase | null {
    return this.canEnterSearch() ? "search" : null;
  }

  private entryPhaseAfterSearch(): MissionPhase | null {
    if (this.listConfirmedTargets().length >= 1) return "triage";
    if (this.map.snapshot().coveragePct >= this.ctx.objectives.minCoveragePct && this.listConfirmedTargets().length === 0) return "return";
    return null;
  }

  private entryPhaseAfterTriage(): MissionPhase | null {
    if (this.listAssignedTargets().length >= 1) return "rescue";
    return null;
  }

  private entryPhaseAfterRescue(): MissionPhase | null {
    if (this.listAssignedTargets().some((t) => t.position)) return "extraction";
    return null;
  }

  private entryPhaseAfterExtraction(): MissionPhase | null {
    if (this.areObjectivesComplete() || this.ctx.objectives.safetyCritical === false) return "return";
    return null;
  }

  private entryPhaseAfterReturn(): MissionPhase | null {
    return this.areObjectivesComplete() ? "complete" : null;
  }

  private canEnterDiscovery(): boolean {
    const nodes = Object.values(this.ctx.nodes).filter((n) => n.active && n.batteryPct > 15 && n.linkQuality > 0.2);
    const quorum = Math.max(this.ctx.objectives.minQuorumNodes, 1);
    return nodes.length >= quorum && this.requiredRolesSatisfied(this.countRoles(Object.values(this.ctx.nodes)));
  }

  private canEnterSearch(): boolean {
    const snap = this.ctx.map.snapshot();
    const nodes = Object.values(this.ctx.nodes).filter((n) => n.active);
    const quorum = Math.max(this.ctx.objectives.minQuorumNodes, 1);
    return nodes.length >= quorum && snap.coveragePct >= this.ctx.objectives.minCoveragePct;
  }

  private areObjectivesComplete(): boolean {
    const targets = Object.values(this.ctx.targets);
    const confirmed = targets.filter((t) => t.status === "confirmed" || t.status === "assigned" || t.status === "extracted").length;
    const extracted = targets.filter((t) => t.status === "extracted").length;
    const coveragePct = this.ctx.map.snapshot().coveragePct;
    return (
      confirmed >= this.ctx.objectives.totalTargetsConfirmed ||
      extracted >= this.ctx.objectives.totalTargetsExtracted ||
      (this.ctx.objectives.totalTargetsExpected > 0 && extracted >= this.ctx.objectives.totalTargetsExpected) ||
      (coveragePct >= this.ctx.objectives.minCoveragePct && confirmed === 0 && this.ctx.objectives.totalTargetsExpected === 0)
    );
  }

  private requiredRolesSatisfied(roleCounts: Record<string, number>): boolean {
    for (const [role, count] of Object.entries(this.ctx.objectives.requiredRoles)) {
      if ((roleCounts[role] ?? 0) < (count ?? 0)) return false;
    }
    return true;
  }

  private countRoles(nodes: NodeStatus[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const node of nodes) counts[node.role] = (counts[node.role] ?? 0) + 1;
    return counts;
  }

  private listConfirmedTargets(): TargetRecord[] {
    return Object.values(this.ctx.targets).filter((t) => t.status === "confirmed" || t.status === "assigned" || t.status === "extracted");
  }

  private listAssignedTargets(): TargetRecord[] {
    return Object.values(this.ctx.targets).filter((t) => t.status === "assigned" || t.status === "extracted");
  }

  private mergeNode(current: NodeStatus, incoming: NodeStatus): NodeStatus {
    return {
      ...current,
      ...incoming,
      batteryPct: Math.max(current.batteryPct, incoming.batteryPct),
      linkQuality: Math.max(current.linkQuality, incoming.linkQuality),
      gpsFix: incoming.gpsFix ?? current.gpsFix,
      active: incoming.active ?? current.active,
      lastSeenMs: Math.max(current.lastSeenMs, incoming.lastSeenMs),
      capabilities: [...new Set([...(current.capabilities ?? []), ...(incoming.capabilities ?? [])])],
      missionId: incoming.missionId ?? current.missionId,
      location: incoming.location ?? current.location ?? null,
    };
  }

  private mergeTarget(current: TargetRecord, incoming: TargetRecord): TargetRecord {
    const rank = (status: TargetRecord["status"]): number => {
      switch (status) {
        case "new":
          return 0;
        case "confirmed":
          return 1;
        case "assigned":
          return 2;
        case "extracted":
          return 3;
        case "lost":
          return 4;
        default:
          return 0;
      }
    };
    const nextStatus = rank(incoming.status) >= rank(current.status) ? incoming.status : current.status;
    return {
      ...current,
      ...incoming,
      status: nextStatus,
      confidence: Math.max(current.confidence, incoming.confidence),
      confirmedBy: [...new Set([...(current.confirmedBy ?? []), ...(incoming.confirmedBy ?? [])])],
      position: incoming.position ?? current.position ?? null,
      assignedTo: incoming.assignedTo ?? current.assignedTo ?? null,
      extractedBy: incoming.extractedBy ?? current.extractedBy ?? null,
      foundAtMs: Math.min(current.foundAtMs, incoming.foundAtMs),
      confirmedAtMs: incoming.confirmedAtMs ?? current.confirmedAtMs ?? null,
      assignedAtMs: incoming.assignedAtMs ?? current.assignedAtMs ?? null,
      extractedAtMs: incoming.extractedAtMs ?? current.extractedAtMs ?? null,
      metadata: { ...(current.metadata ?? {}), ...(incoming.metadata ?? {}) },
    };
  }

  private reasonFor(phase: MissionPhase): TransitionReason {
    switch (phase) {
      case "discovery":
        return TransitionReason.QuorumReached;
      case "search":
        return TransitionReason.CoverageReached;
      case "triage":
        return TransitionReason.TargetConfirmed;
      case "rescue":
        return TransitionReason.TargetAssigned;
      case "extraction":
        return TransitionReason.ContactMade;
      case "return":
        return TransitionReason.ObjectiveComplete;
      case "complete":
        return TransitionReason.ObjectiveComplete;
      case "aborted":
        return TransitionReason.ManualAbort;
      case "init":
      default:
        return TransitionReason.Boot;
    }
  }

  private recordEvent(type: string, payload: Record<string, unknown>): void {
    this.eventLog.push({ tsMs: nowMs(), type, payload });
  }
}

// ---------------------------------------------------------------------------
// Mission transition policy helper
// ---------------------------------------------------------------------------

export class MissionPhasePolicy {
  constructor(private readonly machine: MissionStateMachine) {}

  shouldAdvance(requestedBy: NodeId): boolean {
    return this.machine.advanceIfReady(requestedBy) !== null;
  }

  enforceRequestedPhase(to: MissionPhase, requestedBy: NodeId): PhaseTransitionRecord {
    return this.machine.transition(
      to,
      requestedBy,
      this.machine.phase === "aborted" ? TransitionReason.ManualAbort : TransitionReason.OperatorOverride,
    );
  }

  abortIfUnsafe(requestedBy: NodeId, reason = TransitionReason.SafetyDegraded): PhaseTransitionRecord | null {
    const snapshot = this.machine.snapshot();
    const staleNodes = snapshot.staleNodeCount;
    if (staleNodes > 0 || snapshot.coveragePct < snapshot.objectives.minCoveragePct * 0.25) {
      return this.machine.forceAbort(requestedBy, reason, { staleNodes, coveragePct: snapshot.coveragePct });
    }
    return null;
  }

  nextAction(): MissionPhase | null {
    return this.machine.suggestNextPhase();
  }
}

// ---------------------------------------------------------------------------
// Monotonic delta coordinator
// ---------------------------------------------------------------------------

export class MapDeltaCoordinator {
  constructor(
    private readonly map: MonotonicSharedMap,
    private readonly commit?: PhaseCommitAdapter,
  ) {}

  stageSeen(x: number, y: number, z = 0, owner?: NodeId | null): MapCell {
    return this.map.markSeen(x, y, z, owner);
  }

  stageFrontier(x: number, y: number, z = 0, owner?: NodeId | null): MapCell {
    return this.map.markFrontier(x, y, z, owner);
  }

  stageSearched(x: number, y: number, z = 0, owner?: NodeId | null): MapCell {
    return this.map.markSearched(x, y, z, owner);
  }

  stageBlocked(x: number, y: number, z = 0, owner?: NodeId | null, reason = ""): MapCell {
    return this.map.markBlocked(x, y, z, owner, reason);
  }

  stageTarget(x: number, y: number, z = 0, owner?: NodeId | null, targetType = "victim"): MapCell {
    const cell = this.map.markTarget(x, y, z, owner, targetType);
    this.commit?.commitMapDelta(this.map.delta(50, "target_detection", owner ?? "local"));
    this.commit?.commitMapSnapshot(this.map.snapshot());
    return cell;
  }

  mergeRemote(snapshot: MapSnapshot, sourceNodeId = "remote"): { inserted: number; updated: number; ignored: number } {
    const result = this.map.mergeSnapshot(snapshot, sourceNodeId);
    this.commit?.commitMapSnapshot(this.map.snapshot());
    return result;
  }

  flushDelta(reason = "periodic_sync", sourceNodeId = "local"): MapDelta {
    const delta = this.map.delta(200, reason, sourceNodeId);
    this.commit?.commitMapDelta(delta);
    return delta;
  }

  replaceFromSnapshot(snapshot: MapSnapshot, sourceNodeId = "remote"): { inserted: number; updated: number; ignored: number } {
    return this.mergeRemote(snapshot, sourceNodeId);
  }
}

// ---------------------------------------------------------------------------
// Demo helper
// ---------------------------------------------------------------------------

export function buildDemoMission(): {
  map: MonotonicSharedMap;
  machine: MissionStateMachine;
  policy: MissionPhasePolicy;
  delta: MapDeltaCoordinator;
} {
  const map = new MonotonicSharedMap("demo-map");
  const machine = new MissionStateMachine(
    "mission-demo",
    map,
    {
      totalTargetsExpected: 1,
      totalTargetsConfirmed: 1,
      totalTargetsExtracted: 1,
      minCoveragePct: 20,
      minQuorumNodes: 3,
      requiredRoles: {
        [NodeRole.Explorer]: 1,
        [NodeRole.Relay]: 1,
        [NodeRole.Triage]: 1,
      },
      safetyCritical: true,
      maxStaleNodeAgeMs: 10_000,
    },
    {
      commitTransition: () => void 0,
      commitSnapshot: () => void 0,
      commitDelta: () => void 0,
      commitTarget: () => void 0,
    },
    { incident: "warehouse_collapse" },
  );
  const policy = new MissionPhasePolicy(machine);
  const delta = new MapDeltaCoordinator(map);
  return { map, machine, policy, delta };
}

export function missionStateMachineSmokeDemo(): Record<string, unknown> {
  const { map, machine, policy, delta } = buildDemoMission();

  const nodeA: NodeStatus = {
    nodeId: "node-a",
    role: NodeRole.Explorer,
    batteryPct: 88,
    linkQuality: 0.97,
    gpsFix: true,
    lastSeenMs: nowMs(),
    active: true,
    capabilities: ["camera", "imu", "gps"],
    missionId: "mission-demo",
    location: { x: 5, y: 5, z: 0 },
  };
  const nodeB: NodeStatus = {
    nodeId: "node-b",
    role: NodeRole.Relay,
    batteryPct: 92,
    linkQuality: 0.99,
    gpsFix: true,
    lastSeenMs: nowMs(),
    active: true,
    capabilities: ["relay", "long_range", "camera"],
    missionId: "mission-demo",
    location: { x: 8, y: 5, z: 0 },
  };
  const nodeC: NodeStatus = {
    nodeId: "node-c",
    role: NodeRole.Triage,
    batteryPct: 76,
    linkQuality: 0.93,
    gpsFix: true,
    lastSeenMs: nowMs(),
    active: true,
    capabilities: ["camera", "audio", "indoor"],
    missionId: "mission-demo",
    location: { x: 12, y: 7, z: 0 },
  };
  const nodeD: NodeStatus = {
    nodeId: "node-d",
    role: NodeRole.Rescuer,
    batteryPct: 81,
    linkQuality: 0.95,
    gpsFix: true,
    lastSeenMs: nowMs(),
    active: true,
    capabilities: ["gripper", "payload", "indoor"],
    missionId: "mission-demo",
    location: { x: 15, y: 8, z: 0 },
  };

  machine.registerNode(nodeA);
  machine.registerNode(nodeB);
  machine.registerNode(nodeC);
  machine.registerNode(nodeD);

  const tx1 = machine.transition("discovery", "node-a", TransitionReason.QuorumReached);

  map.markSeen(1, 1, 0, "node-a");
  map.markSeen(2, 1, 0, "node-a");
  map.markFrontier(3, 1, 0, "node-a");
  map.markSeen(4, 2, 0, "node-b");
  map.markSearched(5, 2, 0, "node-b");
  map.markTarget(6, 3, 0, "node-c", "victim", 0.98);
  map.markBlocked(7, 3, 0, "node-c", "collapsed_debris");
  delta.flushDelta("initial_mapping", "node-a");

  const tx2 = machine.transition("search", "node-a", TransitionReason.CoverageReached);

  machine.upsertTarget({
    targetId: "victim-1",
    missionId: "mission-demo",
    targetType: "victim",
    confidence: 0.96,
    position: { x: 6, y: 3, z: 0 },
    confirmedBy: ["node-c"],
    assignedTo: null,
    extractedBy: null,
    foundAtMs: nowMs(),
    confirmedAtMs: nowMs(),
    assignedAtMs: null,
    extractedAtMs: null,
    status: "confirmed",
    metadata: { via: "thermal" },
  });

  const tx3 = machine.transition("triage", "node-c", TransitionReason.TargetConfirmed);
  machine.assignTarget("victim-1", "node-d", "best_extraction_capacity");
  const tx4 = machine.transition("rescue", "node-d", TransitionReason.TargetAssigned);
  machine.extractTarget("victim-1", "node-d", { contact: true, note: "victim_reached" });
  const tx5 = machine.transition("extraction", "node-d", TransitionReason.ContactMade);
  machine.setNodeLocation("node-d", { x: 6, y: 3, z: 0 });
  const tx6 = machine.transition("return", "node-a", TransitionReason.ObjectiveComplete);
  const tx7 = machine.transition("complete", "node-a", TransitionReason.ObjectiveComplete);

  const mapSnapshot = map.snapshot();
  const missionSnapshot = machine.snapshot();

  return {
    phase: machine.phase,
    phaseVersion: machine.phaseVersion,
    transitions: [tx1, tx2, tx3, tx4, tx5, tx6, tx7],
    snapshot: missionSnapshot,
    map: mapSnapshot,
    machine,
    policy,
    mapRef: map,
    nextSuggestedPhase: policy.nextAction(),
    stateMachineCanAdvance: policy.shouldAdvance("node-a"),
    events: machine.listEvents(50),
    nodes: machine.listNodes(),
    targets: machine.listTargets(),
    mapSummary: map.summary(),
  };
}
