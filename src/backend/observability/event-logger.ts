import type { MissionLedgerEvent } from "@/backend/vertex/mission-ledger";
import type { RecoveryReport } from "@/backend/recovery/recovery-manager";
import type { SafetyEvent } from "@/backend/safety/safety-engine";
import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import { stableStringify } from "@/backend/vertex/hash-chain";

export enum LogCategory {
  CONSENSUS = "consensus",
  VALIDATION = "lattice",
  ALLOCATION = "allocation",
  SAFETY = "safety",
  RECOVERY = "recovery",
  SETTLEMENT = "arc",
  MAP_SYNC = "map",
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityLogRecord = {
  level: LogLevel;
  category: LogCategory;
  missionId: string;
  nodeId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  metrics?: Record<string, number>;
  stateSnapshot?: Partial<TashiStateEnvelope>;
  ts: number;
};

const MAX_BUFFER = 2_048;
const buffer: ObservabilityLogRecord[] = [];

function push(rec: ObservabilityLogRecord) {
  buffer.push(rec);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
}

/**
 * In-process structured log sink (replay / operator summaries / Arc-adjacent demos).
 * No external logger dependency — records are queryable for ``/api/logs/:missionId``-style handlers.
 */
export class EventLogger {
  static queryByMission(missionId: string): ObservabilityLogRecord[] {
    return buffer.filter((r) => r.missionId === missionId);
  }

  static all(): ObservabilityLogRecord[] {
    return [...buffer];
  }

  /** Test isolation. */
  static clear(): void {
    buffer.length = 0;
  }

  static vertexOrdered(event: MissionLedgerEvent, state?: Partial<TashiStateEnvelope>): void {
    push({
      level: "info",
      category: LogCategory.CONSENSUS,
      missionId: event.missionId,
      nodeId: event.actorId,
      eventType: event.eventType,
      payload: { sequenceHint: event.payload?.sequence, hashPrefix: event.eventHash.slice(0, 12), plane: event.plane },
      metrics: { latencyMs: Math.max(0, Date.now() - event.timestamp) },
      stateSnapshot: state,
      ts: Date.now(),
    });
  }

  static nodeValidation(nodeId: string, score01: number, missionId: string, reason?: string): void {
    push({
      level: "info",
      category: LogCategory.VALIDATION,
      missionId,
      nodeId,
      eventType: "TRUST_UPDATE",
      payload: { score: score01.toFixed(4), reason: reason ?? "" },
      ts: Date.now(),
    });
  }

  static taskAllocation(assignment: { nodeId: string; task: string; score: number }, missionId: string): void {
    push({
      level: "info",
      category: LogCategory.ALLOCATION,
      missionId,
      nodeId: assignment.nodeId,
      eventType: "TASK_ASSIGNED",
      payload: { task: assignment.task, score: assignment.score.toFixed(4) },
      ts: Date.now(),
    });
  }

  static safetyEscalation(event: SafetyEvent, missionId: string): void {
    push({
      level: event.severity === "critical" ? "warn" : "info",
      category: LogCategory.SAFETY,
      missionId,
      nodeId: event.nodeId,
      eventType: `SAFETY_${event.type.toUpperCase()}`,
      payload: { ...event.payload, severity: event.severity, responseRequired: event.responseRequired },
      metrics: { severityRank: event.severity === "critical" ? 2 : 1 },
      ts: Date.now(),
    });
  }

  static recoveryReport(report: RecoveryReport): void {
    const level: LogLevel = report.currentState === "recovered" ? "info" : "warn";
    push({
      level,
      category: LogCategory.RECOVERY,
      missionId: report.missionId,
      nodeId: report.nodeId,
      eventType: `RECOVERY_${report.currentState.toUpperCase()}`,
      payload: { diagnostics: report.diagnostics, headline: report.headline },
      metrics: {
        checkpointLag: report.diagnostics.checkpointLag,
        mapLagPercent: report.diagnostics.mapLagPercent,
      },
      ts: Date.now(),
    });
  }

  static mapSync(syncStats: { cellsAdded: number; lagPercent: number }, missionId: string): void {
    push({
      level: "debug",
      category: LogCategory.MAP_SYNC,
      missionId,
      eventType: "MAP_SYNC",
      payload: syncStats,
      ts: Date.now(),
    });
  }

  static settlementQueued(manifestHash: string, missionId: string, extra?: Record<string, unknown>): void {
    push({
      level: "info",
      category: LogCategory.SETTLEMENT,
      missionId,
      eventType: "SETTLEMENT_QUEUED",
      payload: { manifestHashPrefix: manifestHash.slice(0, 24), ...extra },
      ts: Date.now(),
    });
  }

  /** JSON line for external aggregation (Loki, CloudWatch, etc.). */
  static toNdjson(records: ObservabilityLogRecord[]): string {
    return records.map((r) => stableStringify(r)).join("\n");
  }
}
