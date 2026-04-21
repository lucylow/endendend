import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { bootstrapMission, missionEnvelopeView, proposeAndCommitPhaseTransition } from "@/backend/api/missions";
import { commitNodeJoin, latticeRecordHeartbeat } from "@/backend/api/nodes";
import { NodeRegistry } from "@/backend/lattice/node-registry";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import {
  commitVertexBatch,
  suggestRecoveryCheckpoint,
  suggestTargetDiscovery,
  suggestTaskAssignment,
} from "@/backend/vertex/consensus-gateway";
import { nominalNextPhase } from "@/backend/shared/mission-phases";
import type { RosterEntry } from "@/backend/shared/mission-state";
import type { TashiStateEnvelope } from "@/backend/shared/tashi-state-envelope";
import type { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { replayMissionFromLedger } from "@/backend/vertex/demo-replay";
import { clearCheckpoint, loadCheckpoint, saveCheckpoint, type CheckpointPayload } from "@/lib/mission/checkpoints";

function scenarioKeyToKind(s: ScenarioKey): MissionScenarioKind {
  return s;
}

function defaultRosterForScenario(scenario: MissionScenarioKind): RosterEntry[] {
  const thermal = scenario === "wildfire" || scenario === "collapsed_building";
  const base = (id: string, role: RosterEntry["role"], caps: string[]): RosterEntry => ({
    nodeId: id,
    role,
    joinedAtMs: Date.now(),
    capabilities: caps,
  });
  if (scenario === "wildfire") {
    return [
      base("node-e1", "explorer", ["thermal", "optical"]),
      base("node-e2", "explorer", ["thermal"]),
      base("node-r1", "relay", ["relay", "audio"]),
      base("node-m1", "medic", ["triage"]),
    ];
  }
  if (scenario === "tunnel") {
    return [
      base("node-e1", "explorer", ["audio"]),
      base("node-e2", "explorer", ["optical"]),
      base("node-r1", "relay", ["relay"]),
      base("node-r2", "relay", ["relay"]),
    ];
  }
  return [
    base("node-e1", "explorer", thermal ? ["thermal", "audio"] : ["optical", "audio"]),
    base("node-e2", "explorer", thermal ? ["thermal"] : ["optical"]),
    base("node-r1", "relay", ["relay", "audio"]),
    base("node-c1", "carrier", ["winch"]),
    base("node-m1", "medic", ["triage"]),
  ];
}

/**
 * In-browser authoritative mission runtime (Vertex + Lattice libraries). Used when no HTTP mesh is available.
 */
export class LocalMissionRuntime {
  readonly ledger: MissionLedger;
  readonly registry: NodeRegistry;
  missionId: string;
  private scenario: MissionScenarioKind;

  private constructor(ledger: MissionLedger, registry: NodeRegistry, missionId: string, scenario: MissionScenarioKind) {
    this.ledger = ledger;
    this.registry = registry;
    this.missionId = missionId;
    this.scenario = scenario;
  }

  static async bootstrap(scenarioKey: ScenarioKey, actorId: string): Promise<LocalMissionRuntime> {
    const scenario = scenarioKeyToKind(scenarioKey);
    const missionId = `mission-${scenario}-${Date.now().toString(36)}`;
    const { ledger } = await bootstrapMission(missionId, actorId, Date.now(), { scenario });
    const registry = new NodeRegistry();
    const rt = new LocalMissionRuntime(ledger, registry, missionId, scenario);
    await rt.seedRosterAndHeartbeats(actorId);
    return rt;
  }

  static fromCheckpoint(cp: CheckpointPayload): LocalMissionRuntime {
    const ledger = new MissionLedger(cp.events);
    const registry = new NodeRegistry();
    const rt = new LocalMissionRuntime(ledger, registry, cp.missionId, cp.scenario);
    rt.rehydrateRegistryFromMission();
    return rt;
  }

  /** When ``expectedScenario`` is set, discard checkpoint if it was saved for a different scenario. */
  static tryRestoreSession(expectedScenario?: ScenarioKey): LocalMissionRuntime | null {
    const cp = loadCheckpoint();
    if (!cp) return null;
    if (expectedScenario && cp.scenario !== expectedScenario) {
      clearCheckpoint();
      return null;
    }
    return LocalMissionRuntime.fromCheckpoint(cp);
  }

  async persistCheckpoint(): Promise<void> {
    saveCheckpoint({
      missionId: this.missionId,
      scenario: this.scenario,
      events: this.ledger.toArray(),
      savedAtMs: Date.now(),
    });
  }

  private rehydrateRegistryFromMission(): void {
    const mission = replayMissionFromLedger(this.ledger.toArray(), this.missionId);
    const now = Date.now();
    for (const e of Object.values(mission.roster)) {
      this.registry.addOrUpdateRosterEntry(e);
      this.registry.heartbeat(e.nodeId, { batteryReserve: 0.72, linkQuality: 0.82, sensors: e.capabilities }, now);
    }
  }

  private async seedRosterAndHeartbeats(actorId: string): Promise<void> {
    const entries = defaultRosterForScenario(this.scenario);
    let t = Date.now();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      t += 10;
      await commitNodeJoin(this.ledger, this.registry, this.missionId, entry, t);
      await latticeRecordHeartbeat(this.ledger, this.registry, this.missionId, entry.nodeId, t + 1, {
        batteryReserve: 0.55 + (i % 3) * 0.12,
        linkQuality: 0.72 + (i % 4) * 0.06,
        sensors: entry.capabilities,
      });
    }
    const cellsKnown = 12 + entries.length * 3;
    const res = await proposeAndCommitPhaseTransition(
      this.ledger,
      this.registry,
      this.missionId,
      actorId,
      "discovery",
      t + 20,
      this.scenario,
      { cellsKnown },
    );
    if (!res.ok && import.meta.env.DEV) console.warn("[LocalMissionRuntime] initial phase", res.reason);
  }

  buildEnvelope(nowMs = Date.now()): TashiStateEnvelope {
    return missionEnvelopeView(this.ledger, this.registry, this.missionId, nowMs, {
      includeRecoveryForRoster: true,
      allocationTaskType: "explorer",
    });
  }

  getScenario(): MissionScenarioKind {
    return this.scenario;
  }

  async advancePhase(actorId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const env = this.buildEnvelope();
    const next = nominalNextPhase(env.mission.phase);
    if (!next) return { ok: false, reason: "terminal" };
    const cellsKnown = env.mission.mapSummary.cellsKnown + 8;
    return proposeAndCommitPhaseTransition(
      this.ledger,
      this.registry,
      this.missionId,
      actorId,
      next,
      Date.now(),
      this.scenario,
      { cellsKnown },
    );
  }

  async addTarget(actorId: string, targetId: string): Promise<void> {
    const sug = suggestTargetDiscovery(this.missionId, actorId, targetId, Date.now(), "operator");
    await commitVertexBatch(this.ledger, [sug]);
  }

  async assignDemoTask(actorId: string): Promise<void> {
    const env = this.buildEnvelope();
    const nodeId = env.lattice.onlineNodeIds[0] ?? Object.keys(env.mission.roster)[0];
    if (!nodeId) return;
    const sug = suggestTaskAssignment(
      this.missionId,
      actorId,
      `task-${Date.now().toString(36)}`,
      nodeId,
      "survey",
      Date.now(),
    );
    await commitVertexBatch(this.ledger, [sug]);
  }

  async recordCheckpoint(actorId: string, label: string): Promise<void> {
    const sug = suggestRecoveryCheckpoint(this.missionId, actorId, label, Date.now());
    await commitVertexBatch(this.ledger, [sug]);
    await this.persistCheckpoint();
  }

  async tickHeartbeats(
    provider?: (nodeId: string) => { batteryReserve: number; linkQuality: number; sensors: string[] } | null,
  ): Promise<void> {
    const now = Date.now();
    const env = this.buildEnvelope();
    for (const id of Object.keys(env.mission.roster)) {
      const prev = this.registry.getTelemetry(id);
      const jitter = (Math.sin(now / 9000 + id.length) + 1) * 0.02;
      const fromSim = provider?.(id);
      const rosterSensors = env.mission.roster[id]?.capabilities ?? prev?.sensors ?? [];
      await latticeRecordHeartbeat(this.ledger, this.registry, this.missionId, id, now, {
        batteryReserve: fromSim
          ? Math.max(0.08, fromSim.batteryReserve)
          : Math.max(0.12, (prev?.batteryReserve ?? 0.7) - 0.008 + jitter),
        linkQuality: fromSim ? Math.max(0.12, fromSim.linkQuality) : Math.max(0.2, (prev?.linkQuality ?? 0.85) - 0.004),
        sensors: fromSim?.sensors?.length ? fromSim.sensors : rosterSensors,
      });
    }
  }
}
