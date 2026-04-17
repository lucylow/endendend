import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { scoreNodeForScenario } from "./capability-scoring";
import { applyReputationDelta, type ReputationDeltaReason, type ReputationEngine } from "./reputation-engine";
import type { MissionState, RosterEntry } from "@/backend/shared/mission-state";
import type { LatticeValidationSnapshot } from "@/backend/shared/tashi-state-envelope";

export type NodeTelemetry = {
  nodeId: string;
  online: boolean;
  lastSeenMs: number;
  batteryReserve: number;
  linkQuality: number;
  sensors: string[];
};

/** Hard capacity / sensor floors checked by Lattice before Vertex overcommits. */
export type MissionBudget = {
  minNodes: number;
  minRelays: number;
  minExplorers: number;
  minExtractors: number;
  minTriage: number;
  maxRisk: number;
  minBatteryReserve: number;
  requiredSensors: string[];
  /** For hazmat-style redundancy: minimum nodes that expose ``gas`` (after roster + telemetry merge). */
  minGasRedundantNodes?: number;
};

export const SCENARIO_BUDGETS: Record<MissionScenarioKind, MissionBudget> = {
  collapsed_building: {
    minNodes: 5,
    minRelays: 1,
    minExplorers: 2,
    minExtractors: 1,
    minTriage: 1,
    maxRisk: 0.3,
    minBatteryReserve: 0.4,
    requiredSensors: ["thermal", "audio"],
  },
  flood_rescue: {
    minNodes: 6,
    minRelays: 1,
    minExplorers: 2,
    minExtractors: 2,
    minTriage: 1,
    maxRisk: 0.4,
    minBatteryReserve: 0.5,
    requiredSensors: ["optical"],
  },
  hazmat: {
    minNodes: 5,
    minRelays: 2,
    minExplorers: 1,
    minExtractors: 1,
    minTriage: 1,
    maxRisk: 0.1,
    minBatteryReserve: 0.6,
    requiredSensors: ["gas", "thermal"],
    minGasRedundantNodes: 2,
  },
  tunnel: {
    minNodes: 4,
    minRelays: 2,
    minExplorers: 2,
    minExtractors: 0,
    minTriage: 0,
    maxRisk: 0.35,
    minBatteryReserve: 0.35,
    requiredSensors: [],
  },
  wildfire: {
    minNodes: 4,
    minRelays: 1,
    minExplorers: 2,
    minExtractors: 0,
    minTriage: 1,
    maxRisk: 0.45,
    minBatteryReserve: 0.45,
    requiredSensors: ["thermal"],
  },
  extraction: {
    minNodes: 3,
    minRelays: 1,
    minExplorers: 1,
    minExtractors: 2,
    minTriage: 0,
    maxRisk: 0.4,
    minBatteryReserve: 0.35,
    requiredSensors: [],
  },
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

  /**
   * Lattice budget gate: roster + live telemetry must satisfy scenario floors
   * before Vertex commits assignments that would overcommit the swarm.
   */
  validateScenarioBudget(
    scenario: MissionScenarioKind,
    mission: MissionState,
    nowMs: number,
    staleMs: number,
  ): { ok: true } | { ok: false; reason: string } {
    const budget = SCENARIO_BUDGETS[scenario];
    const rosterIds = Object.keys(mission.roster);

    const eligible = rosterIds.filter((id) => {
      const tel = this.telemetry.get(id);
      if (!tel?.online || nowMs - tel.lastSeenMs > staleMs) return false;
      if (this.latticeTrust01(id) < 0.3) return false;
      const minTrust = 1 - budget.maxRisk;
      if (this.latticeTrust01(id) + 1e-6 < minTrust) return false;
      if (tel.batteryReserve + 1e-6 < budget.minBatteryReserve) return false;
      return true;
    });

    if (eligible.length < budget.minNodes) {
      return { ok: false, reason: `lattice_budget:min_nodes:${eligible.length}<${budget.minNodes}` };
    }

    const relays = eligible.filter((id) => {
      const r = mission.roster[id];
      return r && (r.role === "relay" || r.capabilities.some((c) => c.toLowerCase().includes("relay")));
    });
    const explorers = eligible.filter((id) => {
      const r = mission.roster[id];
      return r && (r.role === "explorer" || r.capabilities.some((c) => c.toLowerCase().includes("explorer")));
    });
    const extractors = eligible.filter((id) => {
      const r = mission.roster[id];
      if (!r) return false;
      return (
        r.role === "carrier" ||
        r.capabilities.some((c) => ["carrier", "winch", "boat"].includes(c.toLowerCase()))
      );
    });
    const triage = eligible.filter((id) => {
      const r = mission.roster[id];
      return r && (r.role === "medic" || r.capabilities.some((c) => c.toLowerCase().includes("medic")));
    });

    if (relays.length < budget.minRelays) return { ok: false, reason: "lattice_budget:relays" };
    if (explorers.length < budget.minExplorers) return { ok: false, reason: "lattice_budget:explorers" };
    if (extractors.length < budget.minExtractors) return { ok: false, reason: "lattice_budget:extractors" };
    if (triage.length < budget.minTriage) return { ok: false, reason: "lattice_budget:triage" };

    for (const sensor of budget.requiredSensors) {
      const s = sensor.toLowerCase();
      const covered = eligible.some((id) => this.listSensorHints(id).includes(s));
      if (!covered) return { ok: false, reason: `lattice_budget:sensor:${sensor}` };
    }

    const gasNeed = budget.minGasRedundantNodes ?? 0;
    if (gasNeed > 0) {
      const gasNodes = eligible.filter((id) => this.listSensorHints(id).includes("gas")).length;
      if (gasNodes < gasNeed) return { ok: false, reason: "lattice_budget:gas_redundancy" };
    }

    return { ok: true };
  }

  /**
   * Persist ``reputation_update`` rows for every roster node, then mirror scores into the
   * in-memory trust map (0–100 band used by ``latticeTrust01``).
   */
  async syncTrustFromLedgerReputation(missionId: string, engine: ReputationEngine, nowMs: number): Promise<void> {
    const scores = await engine.getMissionScores(missionId, nowMs);
    for (const s of scores) {
      this.trust.set(s.nodeId, Math.round(Math.max(0, Math.min(1, s.finalScore)) * 100));
    }
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

  exportSnapshot(nowMs: number, capacityScenario: MissionScenarioKind = "collapsed_building"): LatticeValidationSnapshot {
    const onlineNodeIds = [...this.telemetry.entries()]
      .filter(([, v]) => v.online)
      .map(([k]) => k);
    const trustScores = Object.fromEntries(this.trust);
    return {
      capturedAtMs: nowMs,
      onlineNodeIds,
      trustScores,
      capacityHints: this.capacityScores(capacityScenario, nowMs, 30_000),
    };
  }

  /** Lattice trust normalized to ``[0,1]`` (raw scores default around 0–100). */
  latticeTrust01(nodeId: string): number {
    const raw = this.trust.get(nodeId) ?? 100;
    return Math.min(1, Math.max(0, raw / 100));
  }

  /** Union of roster capabilities and last-known telemetry sensors (lowercased). */
  listSensorHints(nodeId: string): string[] {
    const tel = this.telemetry.get(nodeId);
    const roster = this.rosterRef[nodeId];
    const set = new Set<string>();
    for (const s of tel?.sensors ?? []) set.add(s.toLowerCase());
    for (const c of roster?.capabilities ?? []) set.add(c.toLowerCase());
    return [...set];
  }
}
