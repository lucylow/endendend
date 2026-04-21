import { buildEngineConfig, createRng } from "./config";
import { emitEvent, resetEventIdCounter } from "./eventStream";
import { initialTunnelMap, markRelayAnchors, markStaleBeyondPartition, updateMapFromExplorer } from "./mapGenerator";
import { DEFAULT_NODE_PROFILES, initialRoleForProfile } from "./nodeProfiles";
import { applyRelayFailure, recoverySyncPulse, tryActivateBackup } from "./recoveryModel";
import { chainIsPartitioned, pickExplorer, planRelayChain } from "./relayPlanner";
import { missionPhaseFromIngress, signalHopsAlongChain } from "./signalModel";
import { allocateTunnelTasks } from "./taskAllocator";
import { buildTelemetry } from "./telemetryGenerator";
import type {
  CollectiveMapDelta,
  DaisyEvent,
  EngineConfig,
  EngineSnapshot,
  MissionPhase,
  ScenarioVariantId,
  SimNode,
  SwarmTask,
  TelemetrySample,
} from "./types";

function cloneNode(p: (typeof DEFAULT_NODE_PROFILES)[0], index: number): SimNode {
  return {
    profile: p,
    s: index * 0.35,
    lateral: 0,
    battery: 94 - index * 3 + (index % 2) * 2,
    role: initialRoleForProfile(p),
    isRelay: false,
    relayFrozen: false,
    relayHoldS: null,
    connectivity: "online",
    localTask: index === 0 ? "advance_frontier" : "convoy",
    lastHeartbeat: 0,
    trust: 0.88 - index * 0.02,
    forwardLoad: 0,
    hopLoss: 0,
    hopLatency: 0,
  };
}

export function simNodeId(n: SimNode): string {
  return n.profile.id;
}

export class DynamicDaisyScenarioEngine {
  private _cfg: EngineConfig;
  get cfg(): EngineConfig {
    return this._cfg;
  }
  private rng: () => number;
  private t = 0;
  private nodes: SimNode[];
  private map: ReturnType<typeof initialTunnelMap>;
  private tasks: SwarmTask[] = [];
  private events: DaisyEvent[] = [];
  private collectiveDeltas: CollectiveMapDelta[] = [];
  private telemetryRing: TelemetrySample[] = [];
  private phase: MissionPhase = "preflight";
  private targetConfirmed = false;
  private lastPlanNotes: string[] = [];
  private forcedDropDone = false;
  private variant: ScenarioVariantId["id"];

  constructor(seed: number, variant: ScenarioVariantId["id"] = "default") {
    this.variant = variant;
    resetEventIdCounter(seed);
    this._cfg = buildEngineConfig(seed, variant);
    this.rng = createRng(seed);
    this.nodes = DEFAULT_NODE_PROFILES.map((p, i) => cloneNode(p, i));
    this.map = initialTunnelMap(this.cfg);
  }

  reset(seed: number, variant: ScenarioVariantId["id"] = "default") {
    this.variant = variant;
    resetEventIdCounter(seed);
    this._cfg = buildEngineConfig(seed, variant);
    this.rng = createRng(seed);
    this.t = 0;
    this.nodes = DEFAULT_NODE_PROFILES.map((p, i) => cloneNode(p, i));
    this.map = initialTunnelMap(this.cfg);
    this.tasks = [];
    this.events = [];
    this.collectiveDeltas = [];
    this.telemetryRing = [];
    this.phase = "preflight";
    this.targetConfirmed = false;
    this.lastPlanNotes = [];
    this.forcedDropDone = false;
  }

  getVariant(): ScenarioVariantId["id"] {
    return this.variant;
  }

  step(dt: number): EngineSnapshot {
    this.t += dt;
    const lead = pickExplorer(this.nodes);
    if (!lead) return this.snapshot();

    if (this.phase === "preflight" && this.t > 0.2) {
      this.phase = "tunnel_entry";
      this.events.push(emitEvent(this.t, "tunnel_entry", "Swarm crosses ingress; mesh at entrance", this.nodes.map(simNodeId)));
    }

    const ordered = [...this.nodes].sort((a, b) => a.s - b.s);
    let idx = 0;
    for (const n of ordered) {
      if (simNodeId(n) === simNodeId(lead)) {
        n.s = Math.min(this.cfg.tunnel.lengthM, n.s + this.cfg.explorerSpeed * dt);
        n.role = "lead_explorer";
        n.isRelay = false;
        n.relayFrozen = false;
        n.relayHoldS = null;
        n.localTask = "frontier_exploration";
      } else if (n.isRelay && n.relayFrozen) {
        if (n.relayHoldS != null) n.s = n.relayHoldS;
        n.forwardLoad = Math.min(1, n.forwardLoad + dt * 0.08);
        n.localTask = "relay_hold";
      } else {
        const frac = ordered.length > 1 ? idx / Math.max(1, ordered.length - 1) : 0;
        const desired = Math.max(0, lead.s * (0.25 + frac * 0.55) - this.rng() * 2);
        const spd = this.cfg.followerCreep * (0.85 + n.profile.tunnelSuitability * 0.2);
        n.s = Math.min(lead.s - 1.5, n.s + spd * dt * (n.s < desired ? 1.2 : 0.35));
        n.s = Math.max(0, n.s);
        n.localTask = n.profile.indoorSuitability > 0.85 ? "lidar_scan" : "convoy";
        n.forwardLoad = Math.max(0, n.forwardLoad - dt * 0.05);
      }
      idx += 1;
    }

    const plan = planRelayChain(this.nodes, lead, this.cfg.tunnel, this.cfg, this.rng);
    this.lastPlanNotes = plan.notes;
    const prevRelays = new Set(this.nodes.filter((n) => n.isRelay && simNodeId(n) !== simNodeId(lead)).map(simNodeId));

    for (const n of this.nodes) {
      const inPlan = plan.orderedRelayIds.includes(simNodeId(n)) && simNodeId(n) !== simNodeId(lead);
      if (inPlan) {
        if (!n.isRelay) {
          n.isRelay = true;
          n.relayFrozen = true;
          n.relayHoldS = n.s;
          n.role = "relay";
          this.events.push(
            emitEvent(this.t, "relay_selected", `Autonomous relay selection: ${simNodeId(n)}`, [simNodeId(n)], {
              score: Math.round(n.profile.relaySuitability * 100),
            }),
          );
          this.events.push(emitEvent(this.t, "relay_activated", `${simNodeId(n)} holding for P2P backbone`, [simNodeId(n)]));
        }
      } else if (n.isRelay && simNodeId(n) !== simNodeId(lead)) {
        n.isRelay = false;
        n.relayFrozen = false;
        n.relayHoldS = null;
        n.role = "standby";
        n.localTask = "convoy";
        if (prevRelays.has(simNodeId(n))) {
          this.events.push(emitEvent(this.t, "role_handoff", `${simNodeId(n)} released from relay`, [simNodeId(n)]));
        }
      }
    }

    const partitioned = chainIsPartitioned(plan.leadQuality, this.cfg);
    this.phase = missionPhaseFromIngress(plan.ingressQuality, partitioned);
    if (partitioned) {
      markStaleBeyondPartition(this.map, lead.s * 0.65);
      this.events.push(emitEvent(this.t, "signal_degrade", "Partition risk — chain repair", plan.orderedRelayIds));
      tryActivateBackup(this.nodes, lead, this.cfg, this.t, this.events, this.rng);
      recoverySyncPulse(this.t, this.events, plan.orderedRelayIds);
      this.phase = "recovering";
    }

    const fc = this.cfg.forcedRelayFailure;
    if (fc && !this.forcedDropDone && this.t >= fc.atT) {
      applyRelayFailure(this.nodes, fc.nodeId, this.t, this.events);
      this.forcedDropDone = true;
    }

    this.collectiveDeltas = [];
    updateMapFromExplorer(this.map, lead, dt, simNodeId(lead), this.collectiveDeltas, this.t);
    markRelayAnchors(
      this.map,
      this.nodes.filter((n) => n.isRelay),
    );

    if (!this.targetConfirmed && lead.s > this.cfg.tunnel.lengthM * 0.62) {
      if (this.rng() < this.cfg.targetDiscoveryChancePerSec * dt * 8) {
        this.events.push(emitEvent(this.t, "target_candidate", "Thermal anomaly — possible survivor", [simNodeId(lead)]));
        if (this.rng() > 0.35) {
          this.targetConfirmed = true;
          this.events.push(emitEvent(this.t, "target_confirmed", "Victim zone confirmed; map delta broadcast", [simNodeId(lead)]));
        }
      }
    }

    this.tasks = allocateTunnelTasks(this.nodes, lead, this.t, this.tasks, this.events);

    for (const n of this.nodes) {
      n.lastHeartbeat = this.t;
      if (simNodeId(n) === simNodeId(lead)) n.battery -= this.cfg.batteryDrainExplorer * dt;
      else if (n.isRelay) n.battery -= this.cfg.batteryDrainRelay * dt * (1 + n.forwardLoad);
      else n.battery -= this.cfg.batteryDrainIdle * dt;
      n.battery = Math.max(0, n.battery);
      if (n.battery < 12 && n.connectivity === "online") {
        n.connectivity = "degraded";
      }
    }

    const telem = buildTelemetry(this.nodes, lead, this.cfg, this.t, this.rng);
    this.telemetryRing = telem.slice(0, 32);

    if (lead.s >= this.cfg.tunnel.lengthM - 0.5) {
      this.phase = "mission_complete";
      this.events.push(emitEvent(this.t, "mission_complete", "Tunnel terminus reached; collective map persisted", this.nodes.map(simNodeId)));
    }

    if (this.t < 0.5 && this.events.every((e) => e.type !== "mission_start")) {
      this.events.unshift(emitEvent(0, "mission_start", "Dynamic Daisy Chain — mock runtime online", this.nodes.map(simNodeId)));
    }

    return this.snapshot(plan);
  }

  private snapshot(plan: ReturnType<typeof planRelayChain>): EngineSnapshot {
    const lead = pickExplorer(this.nodes);
    const p = lead ? plan : null;
    const nodeMap = new Map<string, SimNode>(this.nodes.map((n) => [simNodeId(n), n]));
    if (lead && p) {
      const entranceNode: SimNode = {
        ...lead,
        profile: { ...lead.profile, id: "__entrance__" },
        s: this.cfg.tunnel.entranceS,
        isRelay: true,
        relayFrozen: true,
        relayHoldS: 0,
        role: "relay",
        forwardLoad: 0,
        hopLoss: 0,
        hopLatency: 0,
      };
      nodeMap.set("__entrance__", entranceNode);
    }
    const signalHops =
      lead && p
        ? signalHopsAlongChain(
            ["__entrance__", ...p.orderedRelayIds, simNodeId(lead)],
            nodeMap,
            this.cfg.tunnel,
            this.rng,
            0.3,
          )
        : [];

    return {
      t: this.t,
      phase: this.phase,
      nodes: this.nodes.map((n) => ({ ...n, profile: { ...n.profile, sensor: { ...n.profile.sensor } } })),
      relayPlan: p ?? {
        orderedRelayIds: [],
        chainPath: [],
        ingressQuality: 0,
        leadQuality: 0,
        notes: this.lastPlanNotes,
      },
      map: {
        cells: this.map.cells.map((c) => ({ ...c })),
        coverage: this.map.coverage,
        frontierS: this.map.frontierS,
      },
      tasks: this.tasks.map((x) => ({ ...x })),
      events: this.events.slice(-400),
      telemetry: this.telemetryRing,
      collectiveDeltas: this.collectiveDeltas.slice(),
      signalHops,
      rngStream: 0,
    };
  }

  getEvents(): DaisyEvent[] {
    return this.events.slice();
  }

  getLastPlanNotes(): string[] {
    return this.lastPlanNotes.slice();
  }
}
