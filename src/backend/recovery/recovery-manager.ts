import type { MissionState } from "@/backend/shared/mission-state";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { MissionLedger } from "@/backend/vertex/mission-ledger";
import type { ReputationEngine } from "@/backend/lattice/reputation-engine";

export type RecoveryState =
  | "syncing"
  | "replaying"
  | "revalidating"
  | "recovered"
  | "degraded"
  | "stale"
  | "isolated";

export type RecoveryOperatorAction = "monitor" | "manual_sync" | "isolate";

export interface RecoveryDiagnostics {
  /** Events behind global tail at assessment time (before replay). */
  initialCheckpointLag: number;
  /** Remaining events behind tail after recovery steps in this call. */
  checkpointLag: number;
  /** Local map coverage vs mission map (0–100). */
  mapLagPercent: number;
  /** Commands considered unsafe after checkpoint catch-up. */
  discardedCommands: number;
  /** Ledger rows replay-applied in this recovery pass. */
  replayedEvents: number;
  pendingTrustRevalidation: boolean;
  peerSyncCount: number;
  lastPeerContactMs: number;
}

export interface RecoveryReport {
  nodeId: string;
  missionId: string;
  currentState: RecoveryState;
  diagnostics: RecoveryDiagnostics;
  operatorActions: RecoveryOperatorAction[];
  /** Human-readable line for dashboards / demos. */
  headline: string;
  timestamp: number;
}

export type RecoveryRecoverContext = {
  /** Override local tail hash (otherwise ledger ``recovery_checkpoint`` / seeded map). */
  localCheckpointEventHash?: string;
  /** Node-local fused cell count vs ``mission.mapSummary.cellsKnown``. */
  localMapCells?: number;
  /** Force first-tick connect semantics (operator-visible ``syncing``). */
  initialHandshake?: boolean;
};

const STALE_LAG = 100;
const REPLAY_LAG = 20;
const MAP_DEGRADED_PCT = 3;

function stableHash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function missionCheckpointIndex(events: { eventHash: string }[], localTail: string): number {
  if (localTail === "genesis") return -1;
  const idx = events.findIndex((e) => e.eventHash === localTail);
  return idx;
}

function formatRecoveryHeadline(report: RecoveryReport): string {
  const { nodeId, currentState, diagnostics: d } = report;
  const lag = d.initialCheckpointLag;
  const map = d.mapLagPercent.toFixed(1);
  if (currentState === "isolated") {
    return `${nodeId}: isolated (no fresh peer sync)`;
  }
  if (currentState === "stale") {
    return `${nodeId}: stale ledger (${lag} events behind) — manual sync or isolate`;
  }
  if (currentState === "degraded") {
    const replay = d.replayedEvents > 0 ? `, replayed ${d.replayedEvents} events` : "";
    return `${nodeId}: degraded — map ${map}% behind${replay} — monitor`;
  }
  if (currentState === "replaying") {
    return `${nodeId}: replaying ${d.replayedEvents} events (was ${lag} behind)`;
  }
  if (currentState === "revalidating") {
    return `${nodeId}: revalidating Lattice trust (${lag} event gap)`;
  }
  if (currentState === "syncing") {
    return `${nodeId}: syncing to Vertex tail`;
  }
  if (d.replayedEvents > 0) {
    return `${nodeId}: recovered — replayed ${d.replayedEvents} events, map ${map}% behind`;
  }
  return `${nodeId}: recovered — checkpoint aligned, map ${map}% behind`;
}

export function recoveryAggregateSyncStatus(
  reports: RecoveryReport[],
): "synced" | "catching_up" | "stale" {
  if (!reports.length) return "synced";
  if (reports.some((r) => r.currentState === "stale" || r.currentState === "isolated")) return "stale";
  if (
    reports.some((r) =>
      ["syncing", "replaying", "revalidating"].includes(r.currentState),
    )
  ) {
    return "catching_up";
  }
  return "synced";
}

export class RecoveryManager {
  private readonly ledger: MissionLedger;
  private readonly registry: NodeRegistry;
  private readonly reputation?: ReputationEngine;
  /** ``missionId:nodeId`` → last acknowledged event hash (simulates on-node storage). */
  private readonly localTails = new Map<string, string>();
  private readonly logRing: RecoveryReport[] = [];
  private static readonly LOG_CAP = 128;

  constructor(ledger: MissionLedger, registry: NodeRegistry, reputation?: ReputationEngine) {
    this.ledger = ledger;
    this.registry = registry;
    this.reputation = reputation;
  }

  /** Test / demo hook: seed what the node believes is its ledger tail. */
  seedLocalCheckpoint(missionId: string, nodeId: string, eventHash: string): void {
    this.localTails.set(`${missionId}:${nodeId}`, eventHash);
  }

  getLocalCheckpoint(missionId: string, nodeId: string, ctx?: RecoveryRecoverContext): string {
    if (ctx?.localCheckpointEventHash) return ctx.localCheckpointEventHash;
    const key = `${missionId}:${nodeId}`;
    if (this.localTails.has(key)) return this.localTails.get(key)!;
    const events = this.ledger.eventsForMission(missionId);
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.eventType !== "recovery_checkpoint") continue;
      const nid = String(e.payload?.nodeId ?? e.actorId ?? "");
      if (nid === nodeId) return e.eventHash;
    }
    return "genesis";
  }

  recentRecoveryLogs(limit = 32): RecoveryReport[] {
    return this.logRing.slice(-limit);
  }

  recoverNode(
    nodeId: string,
    missionId: string,
    mission: MissionState,
    nowMs: number,
    ctx?: RecoveryRecoverContext,
  ): RecoveryReport {
    const events = this.ledger.eventsForMission(missionId);
    const globalLen = events.length;
    const localTail = this.getLocalCheckpoint(missionId, nodeId, ctx);
    const cpIndex = missionCheckpointIndex(events, localTail);
    const initialLag = cpIndex < 0 ? globalLen : Math.max(0, globalLen - 1 - cpIndex);

    const rosterIds = Object.keys(mission.roster);
    const staleMs = 30_000;
    const peerSyncCount = this.registry.getPeerSyncCount(nodeId, rosterIds, nowMs, staleMs);
    const lastPeerContactMs = this.registry.lastPeerContactMs(nodeId, rosterIds, nowMs, staleMs);

    let state: RecoveryState = "recovered";
    let replayedEvents = 0;
    let pendingTrust = false;

    if (initialLag > STALE_LAG) {
      state = "stale";
    } else if (peerSyncCount === 0 && rosterIds.length > 1) {
      state = "isolated";
    } else if (initialLag > REPLAY_LAG) {
      replayedEvents = this.replayEvents(nodeId, missionId, initialLag);
      this.advanceLocalTailToMissionTail(missionId, nodeId);
      state = "recovered";
    } else if (initialLag > 0) {
      state = "revalidating";
      pendingTrust = true;
      this.refreshTrust(nodeId, missionId, nowMs);
      pendingTrust = false;
      this.advanceLocalTailToMissionTail(missionId, nodeId);
      state = "recovered";
    } else if (ctx?.initialHandshake) {
      state = "syncing";
    }

    const residualLag = this.computeResidualLag(missionId, nodeId, ctx);
    const mapLagPercent = this.computeMapLag(nodeId, mission, ctx);
    const discarded = this.countDiscardedStaleCommands(nodeId, mission, cpIndex, events);

    if (
      mapLagPercent >= MAP_DEGRADED_PCT &&
      (state === "recovered" || state === "syncing")
    ) {
      state = "degraded";
    }

    const operatorActions = this.getOperatorActions(state, initialLag, mapLagPercent);

    const report: RecoveryReport = {
      nodeId,
      missionId,
      currentState: state,
      diagnostics: {
        initialCheckpointLag: initialLag,
        checkpointLag: residualLag,
        mapLagPercent,
        discardedCommands: discarded,
        replayedEvents,
        pendingTrustRevalidation: pendingTrust,
        peerSyncCount,
        lastPeerContactMs,
      },
      operatorActions,
      headline: "",
      timestamp: nowMs,
    };
    report.headline = formatRecoveryHeadline(report);
    this.logRecoveryEvent(report);
    return report;
  }

  private computeResidualLag(missionId: string, nodeId: string, ctx?: RecoveryRecoverContext): number {
    const events = this.ledger.eventsForMission(missionId);
    const globalLen = events.length;
    const tail = this.getLocalCheckpoint(missionId, nodeId, ctx);
    const idx = missionCheckpointIndex(events, tail);
    return idx < 0 ? globalLen : Math.max(0, globalLen - 1 - idx);
  }

  private replayEvents(nodeId: string, missionId: string, lag: number): number {
    const events = this.ledger.eventsForMission(missionId);
    const start = Math.max(0, events.length - lag);
    const slice = events.slice(start);
    void nodeId;
    return slice.length;
  }

  private advanceLocalTailToMissionTail(missionId: string, nodeId: string): void {
    const tail = this.ledger.missionTailHash(missionId);
    this.localTails.set(`${missionId}:${nodeId}`, tail);
  }

  private refreshTrust(nodeId: string, missionId: string, _nowMs: number): void {
    if (!this.reputation) return;
    const row = this.reputation.evaluateFromLedger(nodeId, missionId);
    this.registry.setLatticeTrustFrom01(nodeId, row.finalScore);
  }

  private computeMapLag(
    nodeId: string,
    mission: MissionState,
    ctx?: RecoveryRecoverContext,
  ): number {
    const globalCells = Math.max(0, mission.mapSummary.cellsKnown ?? 0);
    if (ctx?.localMapCells != null && globalCells > 0) {
      const behind = Math.max(0, globalCells - ctx.localMapCells);
      return Math.min(100, (behind / globalCells) * 100);
    }
    if (globalCells <= 0) return 0;
    const jitter = (stableHash32(`${nodeId}:${mission.missionId}`) % 10_000) / 10_000;
    const localFrac = 0.92 + 0.08 * jitter;
    const localCells = Math.floor(globalCells * localFrac);
    const behind = globalCells - localCells;
    return Math.min(100, (behind / globalCells) * 100);
  }

  private countDiscardedStaleCommands(
    nodeId: string,
    mission: MissionState,
    checkpointIndex: number,
    events: { timestamp: number }[],
  ): number {
    const checkpointTs = checkpointIndex >= 0 ? events[checkpointIndex]?.timestamp ?? 0 : 0;
    let n = 0;
    for (const a of Object.values(mission.assignments)) {
      if (a.nodeId === nodeId && a.assignedAtMs > checkpointTs) n++;
    }
    return n;
  }

  private getOperatorActions(
    state: RecoveryState,
    initialLag: number,
    mapLagPercent: number,
  ): RecoveryOperatorAction[] {
    const actions = new Set<RecoveryOperatorAction>();
    if (state === "stale" || state === "isolated") {
      actions.add("manual_sync");
      actions.add("isolate");
    }
    if (state === "degraded" || mapLagPercent >= MAP_DEGRADED_PCT) actions.add("monitor");
    if (state === "replaying" || state === "revalidating" || state === "syncing") actions.add("monitor");
    if (state === "stale" && initialLag > STALE_LAG * 2) actions.add("monitor");
    return [...actions];
  }

  private logRecoveryEvent(report: RecoveryReport): void {
    this.logRing.push({ ...report });
    if (this.logRing.length > RecoveryManager.LOG_CAP) this.logRing.splice(0, this.logRing.length - RecoveryManager.LOG_CAP);
  }
}
