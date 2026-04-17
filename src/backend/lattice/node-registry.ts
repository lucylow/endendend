import type { MissionScenarioKind } from "./capability-scoring";
import { scoreNodeForScenario } from "./capability-scoring";
import { applyReputationDelta, type ReputationDeltaReason } from "./reputation-engine";
import type { RosterEntry } from "@/backend/shared/mission-state";
import type { LatticeValidationSnapshot } from "@/backend/shared/tashi-state-envelope";

export type NodeTelemetry = {
  nodeId: string;
  online: boolean;
  lastSeenMs: number;
  batteryReserve: number;
  linkQuality: number;
  sensors: string[];
};

export class NodeRegistry {
  private telemetry = new Map<string, NodeTelemetry>();
  private trust = new Map<string, number>();
  private rosterRef: Record<string, RosterEntry> = {};

  seedRoster(roster: Record<string, RosterEntry>): void {
    this.rosterRef = { ...roster };
    for (const id of Object.keys(roster)) {
      if (!this.trust.has(id)) this.trust.set(id, 100);
    }
  }

  addOrUpdateRosterEntry(entry: RosterEntry): void {
    this.rosterRef = { ...this.rosterRef, [entry.nodeId]: entry };
    if (!this.trust.has(entry.nodeId)) this.trust.set(entry.nodeId, 100);
  }

  heartbeat(nodeId: string, patch: Partial<Omit<NodeTelemetry, "nodeId">>, nowMs: number): void {
    const prev = this.telemetry.get(nodeId);
    const next: NodeTelemetry = {
      nodeId,
      online: true,
      lastSeenMs: nowMs,
      batteryReserve: patch.batteryReserve ?? prev?.batteryReserve ?? 1,
      linkQuality: patch.linkQuality ?? prev?.linkQuality ?? 1,
      sensors: patch.sensors ?? prev?.sensors ?? [],
    };
    this.telemetry.set(nodeId, next);
  }

  markOffline(nodeId: string, nowMs: number): void {
    const prev = this.telemetry.get(nodeId);
    if (!prev) return;
    this.telemetry.set(nodeId, { ...prev, online: false, lastSeenMs: nowMs });
  }

  adjustTrust(nodeId: string, delta: number, reason: ReputationDeltaReason): void {
    const scores = Object.fromEntries(this.trust);
    const updated = applyReputationDelta(scores, nodeId, delta, reason);
    for (const [k, v] of Object.entries(updated)) this.trust.set(k, v);
  }

  isValidForRole(nodeId: string, role: RosterEntry["role"], staleMs: number, nowMs: number): boolean {
    const t = this.telemetry.get(nodeId);
    if (!t?.online) return false;
    if (nowMs - t.lastSeenMs > staleMs) return false;
    const r = this.rosterRef[nodeId];
    if (!r) return false;
    if (role === "relay" && t.linkQuality < 0.2) return false;
    if (role === "carrier" && t.batteryReserve < 0.15) return false;
    return true;
  }

  capacityScores(kind: MissionScenarioKind, nowMs: number, staleMs: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, entry] of Object.entries(this.rosterRef)) {
      const tel = this.telemetry.get(id);
      if (!tel?.online || nowMs - tel.lastSeenMs > staleMs) continue;
      let s = scoreNodeForScenario(entry, kind);
      s *= 0.5 + 0.5 * tel.linkQuality;
      s *= 0.6 + 0.4 * Math.min(1, tel.batteryReserve);
      out[id] = Math.round(s * 10) / 10;
    }
    return out;
  }

  exportSnapshot(nowMs: number): LatticeValidationSnapshot {
    const onlineNodeIds = [...this.telemetry.entries()]
      .filter(([, v]) => v.online)
      .map(([k]) => k);
    const trustScores = Object.fromEntries(this.trust);
    return {
      capturedAtMs: nowMs,
      onlineNodeIds,
      trustScores,
      capacityHints: this.capacityScores("collapsed_building", nowMs, 30_000),
    };
  }
}
