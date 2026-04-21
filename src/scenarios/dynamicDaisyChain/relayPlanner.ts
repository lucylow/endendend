import type { EngineConfig } from "./types";
import type { RelayPlanResult } from "./types";
import type { SimNode } from "./types";
import type { TunnelGeometry } from "./types";
import { endToEndQuality, signalHopsAlongChain } from "./signalModel";

function nid(n: SimNode): string {
  return n.profile.id;
}

function entranceVirtualId(): string {
  return "__entrance__";
}

export function pickExplorer(nodes: SimNode[]): SimNode | null {
  const candidates = nodes.filter((n) => n.profile.explorerSuitability >= 0.85);
  if (candidates.length) {
    return candidates.reduce((a, b) => (a.profile.explorerSuitability >= b.profile.explorerSuitability ? a : b));
  }
  return nodes[0] ?? null;
}

function relayCandidateScore(n: SimNode, lead: SimNode, geom: TunnelGeometry, entranceS: number): number {
  if (nid(n) === nid(lead) || n.connectivity === "offline") return -1;
  const mid = (lead.s + entranceS) / 2;
  const anchorBonus = geom.relayAnchorZones.some((z) => n.s >= z.startS && n.s <= z.endS) ? 0.12 : 0;
  const spacing = Math.min(1, Math.abs(n.s - mid) / 25);
  const positionFit = 1 - spacing;
  return (
    n.profile.relaySuitability * 0.42 +
    n.profile.tunnelSuitability * 0.18 +
    (n.battery / 100) * 0.15 +
    positionFit * 0.2 +
    anchorBonus +
    n.trust * 0.05 -
    n.forwardLoad * 0.08
  );
}

/** Pure planner: returns ordered relay ids (subset of nodes) to satisfy ingress→lead quality. */
export function planRelayChain(
  nodes: SimNode[],
  lead: SimNode,
  geom: TunnelGeometry,
  cfg: EngineConfig,
  rng: () => number,
): RelayPlanResult {
  const notes: string[] = [];
  const virtual = entranceVirtualId();
  const byId = new Map(nodes.map((n) => [nid(n), n]));

  const relays = new Set(nodes.filter((n) => n.isRelay && nid(n) !== nid(lead)).map(nid));

  const measure = (relayIds: string[]) => {
    const idChain = [virtual, ...relayIds.sort((a, b) => byId.get(a)!.s - byId.get(b)!.s), nid(lead)];
    const nodeMap = new Map<string, SimNode>();
    const leadNode = byId.get(nid(lead))!;
    nodeMap.set(virtual, {
      ...leadNode,
      profile: { ...leadNode.profile, id: virtual },
      s: geom.entranceS,
      isRelay: true,
      relayFrozen: true,
      relayHoldS: 0,
      role: "relay",
      forwardLoad: 0,
      hopLoss: 0,
      hopLatency: 0,
    });
    for (const id of relayIds) {
      const n = byId.get(id);
      if (n) nodeMap.set(id, n);
    }
    nodeMap.set(nid(lead), leadNode);
    const hops = signalHopsAlongChain(idChain, nodeMap, geom, rng, 0.35);
    const q = endToEndQuality(hops);
    return { idChain, hops, q };
  };

  let relayIds = [...relays].sort((a, b) => byId.get(a)!.s - byId.get(b)!.s);
  let guard = 0;
  while (guard++ < 14) {
    const { hops, q } = measure(relayIds);
    if (q >= 1 - cfg.relayLossThreshold) {
      const ingress = hops.length ? 1 - hops[0].loss : q;
      return {
        orderedRelayIds: relayIds,
        chainPath: ["entrance", ...relayIds, nid(lead)],
        ingressQuality: ingress,
        leadQuality: q,
        notes,
      };
    }

    const standbys = nodes.filter((n) => !relays.has(nid(n)) && nid(n) !== nid(lead) && n.connectivity !== "offline");
    if (!standbys.length) {
      notes.push("no standby candidates");
      break;
    }
    let best: SimNode | null = null;
    let bestScore = -1;
    for (const n of standbys) {
      const sc = relayCandidateScore(n, lead, geom, geom.entranceS);
      if (sc > bestScore) {
        bestScore = sc;
        best = n;
      }
    }
    if (!best) break;
    relays.add(nid(best));
    relayIds = [...relays].sort((a, b) => byId.get(a)!.s - byId.get(b)!.s);
    notes.push(`plan adds ${nid(best)} score=${bestScore.toFixed(2)}`);
  }

  const { hops, q } = measure(relayIds);
  const ingress = hops.length ? 1 - hops[0].loss : q;
  return {
    orderedRelayIds: relayIds,
    chainPath: ["entrance", ...relayIds, nid(lead)],
    ingressQuality: ingress,
    leadQuality: q,
    notes,
  };
}

export function chainIsPartitioned(leadQuality: number, cfg: EngineConfig): boolean {
  return leadQuality < 1 - cfg.partitionLossThreshold;
}
