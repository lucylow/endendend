import type { EngineConfig, SimNode, TelemetrySample } from "./types";
import { directLinkQuality } from "./signalModel";

export function buildTelemetry(
  nodes: SimNode[],
  lead: SimNode,
  cfg: EngineConfig,
  t: number,
  rng: () => number,
): TelemetrySample[] {
  return nodes.map((n) => {
    const qEnt = directLinkQuality(cfg.tunnel, cfg.tunnel.entranceS, n.s, rng, 0.25);
    const qLead = directLinkQuality(cfg.tunnel, n.s, lead.s, rng, 0.25);
    const dust = Math.min(1, (n.s / cfg.tunnel.lengthM) * 0.85 + rng() * 0.08);
    const temp = 18 + (n.s / cfg.tunnel.lengthM) * 6 + rng() * 1.5;
    const obs = Math.max(0, 1 - Math.abs(n.s - lead.s) / (cfg.tunnel.lengthM * 0.2)) * (0.2 + rng() * 0.15);
    return {
      nodeId: n.id,
      t,
      positionS: n.s,
      velocity: n.isRelay && n.relayFrozen ? 0 : n.role === "lead_explorer" ? cfg.explorerSpeed : cfg.followerCreep,
      battery: n.battery,
      linkIngress: Math.max(0, 1 - qEnt.loss),
      linkToLead: Math.max(0, 1 - qLead.loss),
      packetLoss: qEnt.loss * 0.6 + qLead.loss * 0.25,
      latencyMs: (qEnt.latencySec + qLead.latencySec) * 500,
      gpsConfidence: Math.max(0.05, 1 - (n.s / cfg.tunnel.lengthM) * 1.1 - dust * 0.25),
      lidarConfidence: n.profile.sensor.lidarConfidence * (1 - dust * 0.35),
      dust,
      temperatureC: temp,
      obstacleProximity: obs,
    };
  });
}
