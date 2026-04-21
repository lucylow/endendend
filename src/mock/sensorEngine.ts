import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";
import { SeededRandom } from "./seededRandom";
import { getSensorProfile } from "./sensorProfiles";
import type { MockNodeProfile, SensorConfidenceLabel, SensorReadings, TelemetryPacket } from "./types";
import type { MeshSummaryViewModel } from "./types";

export type SensorTickContext = {
  missionId: string;
  scenario: MissionScenarioKind;
  phase: string;
  nowMs: number;
  mesh: MeshSummaryViewModel;
  targetProximity01: number;
  burstMode?: boolean;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export class SensorStreamGenerator {
  private rng: SeededRandom;
  private driftLat = 0;
  private driftLon = 0;
  private degradation = 0;
  private falsePositiveUntil = 0;
  private burstUntil = 0;
  private lastBattery = 0.78;

  constructor(
    seed: string,
    private node: MockNodeProfile,
    private scenario: MissionScenarioKind,
  ) {
    this.rng = new SeededRandom(`${seed}|sensor|${node.nodeId}`);
    this.lastBattery = 0.78 + this.rng.nextFloat(0, 0.18);
  }

  injectFalsePositive(ms: number): void {
    this.falsePositiveUntil = Date.now() + ms;
  }

  injectImuBurst(ms: number): void {
    this.burstUntil = Date.now() + ms;
  }

  reduceDegradation(amount: number): void {
    this.degradation = Math.max(0, this.degradation - amount);
  }

  emit(ctx: SensorTickContext, source: TelemetryPacket["source"]): TelemetryPacket {
    const prof = getSensorProfile(ctx.scenario);
    const t = ctx.nowMs / 1000;
    const meshStress = 1 - ctx.mesh.routeQuality;
    const spike = this.rng.next() < prof.imuSpikeProb || ctx.burstMode || ctx.nowMs < this.burstUntil;

    let gpsFix = prof.gpsBaseline * (1 - meshStress * 0.25) + this.rng.gaussian(0, 0.04);
    if (ctx.scenario === "tunnel") gpsFix *= 0.35;
    gpsFix = clamp01(gpsFix * (1 - this.degradation));

    this.driftLat += (this.rng.next() - 0.5) * prof.indoorDriftPerTick;
    this.driftLon += (this.rng.next() - 0.5) * prof.indoorDriftPerTick;

    const thermalBase =
      ctx.scenario === "wildfire"
        ? 38 + ctx.targetProximity01 * 22 + Math.sin(t / 20) * 4
        : ctx.scenario === "hazmat"
          ? 32 + meshStress * 6
          : 28 + meshStress * 3;
    const thermalC = thermalBase + this.rng.gaussian(0, prof.thermalNoise) + (spike ? this.rng.nextFloat(2, 9) : 0);

    const moisture = clamp01(
      prof.moistureBias + meshStress * 0.12 + (ctx.scenario === "flood_rescue" ? ctx.targetProximity01 * 0.25 : 0) + this.rng.nextFloat(-0.03, 0.05),
    );

    const gasPpm =
      ctx.scenario === "hazmat"
        ? Math.max(0, 8 + meshStress * 40 + (ctx.targetProximity01 > 0.7 ? 55 : 0) + this.rng.gaussian(0, 4))
        : 2 + this.rng.nextFloat(0, 6);

    const smoke = clamp01(
      prof.smokeSensitivity * (0.05 + meshStress * 0.25 + (ctx.scenario === "wildfire" ? 0.35 : 0) + this.rng.nextFloat(-0.02, 0.06)),
    );

    const baseLink =
      nodeLinkPrior(this.node, prof) -
      meshStress * 0.35 -
      prof.linkVolatility * Math.sin(t / 7 + this.node.nodeId.length) -
      (ctx.mesh.partitionActive ? 0.35 : 0);
    const linkQuality = clamp01(baseLink + this.rng.gaussian(0, 0.04));

    const relayLoad = ctx.mesh.graphEdges.filter((e) => e.relay && (e.from === this.node.nodeId || e.to === this.node.nodeId)).length;
    const batteryDrain =
      0.0018 * (1 + meshStress) * prof.relayStressMultiplier +
      relayLoad * 0.0006 +
      (ctx.scenario === "flood_rescue" ? 0.0009 : 0) +
      (this.node.role === "relay" ? 0.0007 : 0);

    this.lastBattery = clamp01(this.lastBattery - batteryDrain + this.rng.gaussian(0, 0.0012) - this.degradation * 0.0008);
    const battery = this.lastBattery;

    const optical =
      clamp01(
        0.75 -
          prof.nightOpticalPenalty * 0.4 -
          smoke * 0.55 -
          (1 - gpsFix) * 0.15 +
          (this.node.capabilities.includes("ir") ? 0.08 : 0) +
          this.rng.gaussian(0, 0.03),
      ) * (1 - this.degradation * 0.25);

    const ir = clamp01(0.35 + (1 - optical) * 0.45 + (ctx.scenario === "wildfire" ? 0.2 : 0) + this.rng.gaussian(0, 0.03));

    const imuVib = clamp01(0.12 + (spike ? 0.55 : 0) + meshStress * 0.25 + this.rng.nextFloat(0, 0.08));

    const confidence = pickConfidence({
      thermalC,
      gasPpm,
      optical,
      ctx,
      falsePositiveActive: ctx.nowMs < this.falsePositiveUntil,
    });

    const sensors: SensorReadings = {
      gpsFix: clamp01(gpsFix),
      gpsConfidence: clamp01(gpsFix * 0.92 + this.rng.nextFloat(-0.05, 0.05)),
      imuVibration: imuVib,
      imuConfidence: clamp01(1 - imuVib * 0.35),
      battery,
      thermalC: Math.round(thermalC * 10) / 10,
      thermalConfidence: clamp01(0.55 + ctx.targetProximity01 * 0.35 - smoke * 0.2),
      opticalConfidence: optical,
      irReflectance: Math.round(ir * 1000) / 1000,
      irConfidence: clamp01(0.5 + ir * 0.45),
      lidarConfidence: clamp01(0.4 + (1 - gpsFix) * 0.45 - smoke * 0.15 + (ctx.scenario === "tunnel" ? 0.12 : 0)),
      audioConfidence: clamp01(0.45 + meshStress * -0.1 + this.rng.nextFloat(-0.03, 0.05)),
      gasPpm: Math.round(gasPpm * 10) / 10,
      gasConfidence: clamp01(ctx.scenario === "hazmat" ? 0.35 + (gasPpm > 30 ? 0.45 : 0) : 0.25),
      smokeDensity: smoke,
      moisture,
      linkQuality,
      cpuLoad: clamp01(0.25 + meshStress * 0.45 + this.rng.nextFloat(-0.04, 0.08)),
      memUsed: clamp01(0.35 + meshStress * 0.25 + this.rng.nextFloat(0, 0.15)),
      altitudeM: Math.round(120 + Math.sin(t / 11) * 12 + this.driftLat * 400),
      speedMps: Math.round((0.4 + ctx.targetProximity01 * 1.2 + meshStress * 0.3 + this.rng.nextFloat(0, 0.4)) * 10) / 10,
      geofenceStatus: pickGeofence(ctx.scenario, gasPpm, prof.hazardGeofenceTightness, this.rng),
    };

    if (ctx.mesh.partitionActive) {
      this.degradation = Math.min(0.85, this.degradation + 0.004);
    } else {
      this.degradation = Math.max(0, this.degradation - 0.002);
    }

    return {
      nodeId: this.node.nodeId,
      missionId: ctx.missionId,
      timestamp: ctx.nowMs,
      scenario: ctx.scenario,
      sensors,
      confidence,
      location: {
        lat: 37.78 + this.driftLat * 0.002,
        lon: -122.41 + this.driftLon * 0.002,
        accuracyM: Math.round((18 + (1 - gpsFix) * 220) * (ctx.scenario === "tunnel" ? 2.4 : 1)),
      },
      velocity: { x: sensors.speedMps * 0.6, y: sensors.speedMps * 0.2, z: spike ? 0.4 : 0.05 },
      health: {
        battery01: sensors.battery,
        thermalStress: clamp01((sensors.thermalC - 26) / 40),
        computeLoad: sensors.cpuLoad,
      },
      connectivity: {
        linkQuality: sensors.linkQuality,
        hopCount: ctx.mesh.relayChain.primary.length,
        relayId: ctx.mesh.relayChain.primary[1] ?? ctx.mesh.relayChain.primary[0] ?? null,
        partition: ctx.mesh.partitionActive,
        syncLagMs: Math.round(40 + meshStress * 600),
      },
      annotations: buildAnnotations(ctx.phase, sensors, confidence),
      source,
    };
  }
}

function nodeLinkPrior(node: MockNodeProfile, prof: ReturnType<typeof getSensorProfile>): number {
  let q = 0.55 + node.relayQuality * 0.35;
  if (node.role === "relay") q += 0.06;
  q -= prof.linkVolatility * 0.25;
  return q;
}

function pickGeofence(
  scenario: MissionScenarioKind,
  gasPpm: number,
  tight: number,
  rng: SeededRandom,
): SensorReadings["geofenceStatus"] {
  if (scenario !== "hazmat") return rng.next() > 0.93 ? "near_edge" : "inside";
  if (gasPpm > 55) return "hazard_zone";
  if (rng.next() < tight * 0.08) return "breach";
  if (rng.next() < 0.12) return "near_edge";
  return "inside";
}

function pickConfidence(args: {
  thermalC: number;
  gasPpm: number;
  optical: number;
  ctx: SensorTickContext;
  falsePositiveActive: boolean;
}): SensorConfidenceLabel {
  if (args.falsePositiveActive) return "false_positive";
  if (args.ctx.mesh.partitionActive) return "weak";
  if (args.ctx.scenario === "hazmat" && args.gasPpm > 45 && args.gasPpm < 58) return "probable";
  if (args.ctx.scenario === "wildfire" && args.thermalC > 52) return "probable";
  if (args.ctx.targetProximity01 > 0.82 && args.optical > 0.55) return "confirmed";
  if (args.ctx.targetProximity01 < 0.15 && args.ctx.phase === "search") return "noise";
  if (args.ctx.mesh.routeQuality < 0.35) return "weak";
  if (args.ctx.mesh.partitionActive === false && args.ctx.phase === "triage") return "recovering";
  return "probable";
}

function buildAnnotations(phase: string, s: SensorReadings, c: SensorConfidenceLabel): string[] {
  const a: string[] = [`phase:${phase}`, `conf:${c}`];
  if (s.gasPpm > 40) a.push("gas_watch");
  if (s.smokeDensity > 0.45) a.push("smoke_occlusion");
  if (s.moisture > 0.55) a.push("water_exposure");
  if (s.imuVibration > 0.45) a.push("motion_spike");
  return a;
}
