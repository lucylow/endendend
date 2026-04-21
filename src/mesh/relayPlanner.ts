import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";
import type { MeshOperationalGraph } from "./types";
import type { RelayNomination } from "./types";
import type { MeshPeerRichProfile } from "./types";

function neighbors(id: string, snap: ConnectivitySnapshot): Set<string> {
  const s = new Set<string>();
  for (const e of snap.edges) {
    if (e.a === id) s.add(e.b);
    if (e.b === id) s.add(e.a);
  }
  return s;
}

/**
 * Autonomous relay nomination from local graph + rich profiles (no fixed relay list).
 */
export function planRelays(args: {
  operatorId: string;
  snap: ConnectivitySnapshot;
  profiles: MeshPeerRichProfile[];
  graph: MeshOperationalGraph;
  rng: () => number;
}): RelayNomination[] {
  const { operatorId, snap, profiles, graph, rng } = args;
  const opN = neighbors(operatorId, snap);
  const scored: RelayNomination[] = [];

  for (const p of profiles) {
    if (p.connectivityState === "offline") continue;
    const nbr = neighbors(p.nodeId, snap);
    let crossPartitionTouches = 0;
    const pc = snap.partitionClusters.findIndex((cl) => cl.includes(p.nodeId));
    if (pc >= 0) {
      for (const x of nbr) {
        const xc = snap.partitionClusters.findIndex((cl) => cl.includes(x));
        if (xc >= 0 && xc !== pc) crossPartitionTouches++;
      }
    }

    const degree = nbr.size;
    const bridgeBonus = graph.bridgeNodes.includes(p.nodeId) ? 0.18 : 0;
    const battery = p.battery01;
    const trust = p.trust01;
    const relayFit = p.relaySuitability01;
    const stationary =
      p.archetype === "relay_drone" || p.archetype === "backup_coordinator" || p.archetype === "sensor_node"
        ? 0.85
        : p.archetype === "scout_drone"
          ? 0.35
          : 0.55;

    const loadEstimate = Math.min(1, p.localQueueDepth / 14 + (graph.bottleneckEdge?.a === p.nodeId || graph.bottleneckEdge?.b === p.nodeId ? 0.15 : 0));

    const touchesOpSide = opN.has(p.nodeId) || [...nbr].some((x) => opN.has(x));
    const score01 = Math.min(
      1,
      0.22 +
        relayFit * 0.38 +
        trust * 0.12 +
        battery * 0.1 +
        bridgeBonus +
        crossPartitionTouches * 0.06 +
        stationary * 0.08 -
        loadEstimate * 0.12 +
        (touchesOpSide ? 0.06 : 0) +
        (rng() - 0.5) * 0.04,
    );

    const reasons: string[] = [];
    if (relayFit > 0.72) reasons.push("high relay suitability");
    if (bridgeBonus) reasons.push("bridges partition neighborhoods");
    if (battery > 0.55) reasons.push("adequate battery headroom");
    if (degree >= 3) reasons.push("high local degree");
    if (crossPartitionTouches) reasons.push("straddles split clusters");
    if (touchesOpSide) reasons.push("keeps operator path alive");
    if (!reasons.length) reasons.push("best marginal score for mesh continuity");

    scored.push({
      nodeId: p.nodeId,
      score01,
      reasons,
      holdsPosition: stationary > 0.65,
      estimatedLoad01: loadEstimate,
    });
  }

  scored.sort((a, b) => b.score01 - a.score01);
  return scored.slice(0, 4);
}
