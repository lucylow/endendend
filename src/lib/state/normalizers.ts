import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import type { NodeRegistry } from "@/backend/lattice/node-registry";
import type { SwarmBackendSnapshot } from "@/lib/tashi-sdk/swarmBackendTypes";
import type {
  DataSource,
  FlatMissionEnvelope,
  MapCellViewModel,
  MapViewModel,
  RewardLineViewModel,
  SettlementPreviewViewModel,
  TaskViewModel,
} from "./types";

const STALE_MS = 30_000;

function healthFromTelemetry(
  online: boolean,
  lastSeenMs: number,
  nowMs: number,
  battery: number,
): FlatMissionEnvelope["nodes"][0]["health"] {
  if (!online) return "stale";
  if (nowMs - lastSeenMs > STALE_MS) return "stale";
  if (battery < 0.2) return "degraded";
  if (battery < 0.35) return "degraded";
  return "online";
}

/** Build flat UI envelope from canonical backend envelope; optionally enrich node rows from Lattice telemetry. */
export function normalizeBackendEnvelopeToFlat(
  env: TashiStateEnvelope,
  source: DataSource,
  registry: NodeRegistry | null,
  nowMs: number = Date.now(),
): FlatMissionEnvelope {
  const mission = env.mission;
  const mapOverview = env.mapOverview ?? {
    exploredCells: mission.mapSummary.cellsKnown ?? 0,
    coveragePercent: 0,
    targets: [],
  };
  const coverage =
    mapOverview.coveragePercent > 0
      ? mapOverview.coveragePercent
      : Math.min(100, Math.round(8 + Math.sqrt(Math.max(0, mapOverview.exploredCells)) * 4));

  const assignmentByNode: Record<string, number> = {};
  for (const a of Object.values(mission.assignments)) {
    assignmentByNode[a.nodeId] = (assignmentByNode[a.nodeId] ?? 0) + 1;
  }

  const rosterIds = Object.keys(mission.roster);
  const nodes: FlatMissionEnvelope["nodes"] = rosterIds.map((nodeId) => {
    const r = mission.roster[nodeId]!;
    const tel = registry?.getTelemetry(nodeId);
    const trust01 =
      typeof env.lattice.trustScores[nodeId] === "number"
        ? Math.max(0, Math.min(1, (env.lattice.trustScores[nodeId] as number) / 100))
        : 0.85;
    const battery = tel?.batteryReserve ?? 0.72;
    const lastSeen = tel?.lastSeenMs ?? nowMs;
    const online = tel?.online ?? env.lattice.onlineNodeIds.includes(nodeId);
    return {
      nodeId,
      role: r.role,
      trust: Math.round(trust01 * 1000) / 1000,
      battery: Math.round(battery * 1000) / 1000,
      health: healthFromTelemetry(online, lastSeen, nowMs, battery),
      activeTasks: assignmentByNode[nodeId] ?? 0,
    };
  });

  const alertsFromStream =
    env.alertStream?.map((a) => ({
      type: a.type,
      severity: a.severity,
      nodeId: a.nodeId,
      message: a.type,
    })) ?? [];

  const alertsFromMission = mission.alerts.map((a) => ({
    type: a.level,
    severity: (a.level === "critical" ? "critical" : "warning") as "warning" | "critical",
    nodeId: a.sourceNodeId ?? "mission",
    message: a.message,
  }));

  const alerts = alertsFromMission.length ? alertsFromMission : alertsFromStream;

  let recovery: FlatMissionEnvelope["recovery"];
  if (env.recovery?.reports?.length) {
    const lag = env.recovery.reports.reduce((m, r) => Math.max(m, r.diagnostics.checkpointLag ?? 0), 0);
    const mapLag = env.recovery.reports.reduce((m, r) => Math.max(m, r.diagnostics.mapLagPercent ?? 0), 0);
    const anyStale = env.recovery.reports.some((r) => r.currentState === "stale");
    recovery = {
      state: anyStale ? "stale" : env.syncStatus === "catching_up" ? "syncing" : "recovered",
      checkpointLag: lag,
      mapLagPct: mapLag,
    };
  } else {
    recovery = {
      state: env.syncStatus === "stale" ? "stale" : env.syncStatus === "catching_up" ? "syncing" : "recovered",
      checkpointLag: 0,
      mapLagPct: 0,
    };
  }

  const settlement =
    env.arc && env.settlement
      ? {
          ready: mission.phase === "complete" || mission.phase === "aborted",
          manifestHash: env.arc.evidenceBundleHash ?? env.settlement.evidenceBundleHash ?? "pending",
        }
      : env.arc
        ? {
            ready: mission.phase === "complete" || mission.phase === "aborted",
            manifestHash: env.arc.evidenceBundleHash ?? "pending",
          }
        : undefined;

  return {
    missionId: mission.missionId,
    scenario: mission.scenario ?? "collapsed_building",
    phase: mission.phase,
    mapSummary: {
      exploredCells: mapOverview.exploredCells,
      coveragePercent: coverage,
      targets: mapOverview.targets.map((t) => ({
        id: t.id,
        confidence: t.confidence,
        status: t.status,
      })),
    },
    nodes,
    alerts,
    recovery,
    settlement,
    backend: env,
    source,
    capturedAtMs: env.capturedAtMs ?? nowMs,
  };
}

export function tasksFromEnvelope(env: TashiStateEnvelope, source: DataSource): TaskViewModel[] {
  const mission = env.mission;
  const assigned = Object.values(mission.assignments).map((a) => ({
    id: a.taskId,
    type: a.taskType,
    assignee: a.nodeId,
    status: "assigned" as const,
    source,
  }));
  const preview = env.allocationPreview;
  if (!preview || assigned.length > 0) return assigned;
  return preview.ranked.slice(0, 6).map((r, i) => ({
    id: `bid-${i}-${r.nodeId}`,
    type: preview.taskType,
    assignee: r.nodeId,
    status: "bidding" as const,
    scoreHint: `${Math.round(r.score * 10) / 10}`,
    source,
  }));
}

export function rewardsFromEnvelope(env: TashiStateEnvelope, source: DataSource): RewardLineViewModel[] {
  const pool = env.swarmHealth?.avgReputation;
  const lines: RewardLineViewModel[] = [];
  let i = 0;
  for (const id of env.lattice.onlineNodeIds.slice(0, 8)) {
    const trust = env.lattice.trustScores[id];
    const amount = typeof trust === "number" ? String(Math.round(trust * 0.42)) : "10";
    lines.push({
      id: `rw-${i++}`,
      nodeId: id,
      kind: "validation",
      amount,
      source,
    });
  }
  if (pool != null && lines.length === 0) {
    lines.push({
      id: "rw-pool",
      nodeId: "swarm",
      kind: "reputation_pool",
      amount: String(Math.round(pool * 100)),
      source,
    });
  }
  return lines;
}

export function settlementPreviewFromEnvelope(
  env: TashiStateEnvelope | null,
  operatorAddress: string | undefined,
  source: DataSource,
): SettlementPreviewViewModel | null {
  if (!env) return null;
  const terminal = env.mission.phase === "complete" || env.mission.phase === "aborted";
  const arc = env.arc;
  const manifest = env.settlement;
  if (arc || manifest) {
    return {
      ready: terminal && !!arc?.manifestId,
      manifestHash: arc?.evidenceBundleHash ?? manifest?.evidenceBundleHash ?? "—",
      settlementAmount: arc?.settlementAmount,
      chainRef: arc?.chainRef,
      operatorAddress,
      mockLabeled: source !== "live" && source !== "live_http",
      source,
    };
  }
  if (terminal) {
    return {
      ready: true,
      manifestHash: "pending-seal",
      operatorAddress,
      mockLabeled: source !== "live" && source !== "live_http",
      source,
    };
  }
  return null;
}

/** Deterministic coarse map grid from explored cell count (UI overview, not GIS). */
export function normalizeMapGridFromCells(
  exploredCells: number,
  seed: string,
  source: DataSource,
): MapViewModel {
  const rows = 8;
  const cols = 12;
  const total = rows * cols;
  const explored = Math.min(total, Math.max(0, exploredCells));
  const grid: MapCellViewModel[] = [];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  let blockedLeft = Math.min(6, Math.floor((Math.abs(h) % 50) / 10));
  const targetIdx = Math.abs(h) % total;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      let state: MapCellViewModel["state"] = "unknown";
      if (idx < explored) state = "explored";
      else if (idx === explored || idx === explored + 1) state = "frontier";
      if (idx % 17 === Math.abs(h) % 17 && blockedLeft > 0) {
        state = "blocked";
        blockedLeft -= 1;
      }
      if (idx === targetIdx) state = "target";
      grid.push({
        row: r,
        col: c,
        state,
        dirty: state === "frontier",
      });
    }
  }
  return {
    grid,
    rows,
    cols,
    syncLabel: source === "live" || source === "live_http" ? "synced" : source === "local_engine" ? "local" : "simulated",
    source,
  };
}

/** Merge HTTP swarm snapshot hints when full SAR envelope is absent. */
export function mergeSwarmSnapshotHints(
  snap: SwarmBackendSnapshot,
  base: FlatMissionEnvelope,
): FlatMissionEnvelope {
  const sar = snap.tashi?.sar;
  const phase = typeof sar?.missionPhase === "string" ? sar.missionPhase : base.phase;
  const missionBrief = snap.tashi?.missionsBrief?.[0];
  const missionId =
    typeof missionBrief?.mission_id === "string" ? missionBrief.mission_id : base.missionId;
  const online =
    typeof sar?.latticeOnline === "number" ? sar.latticeOnline : base.nodes.filter((n) => n.health !== "stale").length;

  return {
    ...base,
    missionId,
    phase,
    source: "live_http",
    mapSummary: {
      ...base.mapSummary,
      coveragePercent: Math.max(base.mapSummary.coveragePercent, Math.min(99, online * 9)),
    },
    nodes:
      base.nodes.length > 0
        ? base.nodes.map((n, i) => (i < online ? { ...n, health: n.health === "stale" ? "online" : n.health } : n))
        : base.nodes,
    capturedAtMs: snap.ts_ms,
  };
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
