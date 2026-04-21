"""Emergent relay selection from signal geometry + suitability (no fixed relay IDs)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import random

from signal_model import TunnelSignalModel, Vec3
from tunnel_geometry import TunnelGeometry


@dataclass
class SimNode:
    id: str
    s: float
    lateral: float
    battery: float
    relay_suitability: float
    explorer_suitability: float
    tunnel_suitability: float
    is_relay: bool
    connectivity: str
    forward_load: float


@dataclass
class RelayPlanResult:
    ordered_relay_ids: List[str]
    chain_path: List[str]
    ingress_quality: float
    lead_quality: float
    notes: List[str]


def _virtual_entrance(geom: TunnelGeometry) -> SimNode:
    return SimNode(
        id="__entrance__",
        s=geom.entrance_s,
        lateral=0.0,
        battery=100.0,
        relay_suitability=1.0,
        explorer_suitability=0.0,
        tunnel_suitability=1.0,
        is_relay=True,
        connectivity="online",
        forward_load=0.0,
    )


def _relay_candidate_score(n: SimNode, lead: SimNode, geom: TunnelGeometry) -> float:
    if n.id == lead.id or n.connectivity == "offline":
        return -1.0
    mid = (lead.s + geom.entrance_s) * 0.5
    in_anchor = any(z0 <= n.s <= z1 for z0, z1, _ in geom.relay_anchor_zones)
    anchor_bonus = 0.12 if in_anchor else 0.0
    spacing = min(1.0, abs(n.s - mid) / 50.0)
    position_fit = 1.0 - spacing
    return (
        n.relay_suitability * 0.42
        + n.tunnel_suitability * 0.18
        + (n.battery / 100.0) * 0.15
        + position_fit * 0.2
        + anchor_bonus
        - n.forward_load * 0.08
    )


def _hops_along_chain(
    ordered_ids: List[str],
    node_by_id: Dict[str, SimNode],
    model: TunnelSignalModel,
) -> List[Tuple[str, str, float]]:
    hops: List[Tuple[str, str, float]] = []
    for i in range(len(ordered_ids) - 1):
        a = node_by_id[ordered_ids[i]]
        b = node_by_id[ordered_ids[i + 1]]
        pa: Vec3 = (a.lateral, 2.0, a.s)
        pb: Vec3 = (b.lateral, 2.0, b.s)
        q = model.link_quality(pa, pb)
        loss = float(q["loss"])
        boosted = a.is_relay or b.is_relay
        if boosted:
            loss = max(0.0, loss - 0.04 * (a.forward_load + b.forward_load) * 0.5)
        hops.append((ordered_ids[i], ordered_ids[i + 1], min(0.97, loss)))
    return hops


def _e2e_quality(hops: List[Tuple[str, str, float]]) -> float:
    if not hops:
        return 0.0
    prod = 1.0
    for _, _, loss in hops:
        prod *= max(0.03, 1.0 - loss)
    return prod


def plan_relay_chain(
    nodes: List[SimNode],
    lead: SimNode,
    geom: TunnelGeometry,
    model: TunnelSignalModel,
    relay_loss_threshold: float,
    rng: random.Random,
) -> RelayPlanResult:
    notes: List[str] = []
    virtual = _virtual_entrance(geom)
    by_id: Dict[str, SimNode] = {n.id: n for n in nodes}
    by_id[virtual.id] = virtual

    relays = {n.id for n in nodes if n.is_relay and n.id != lead.id and n.connectivity != "offline"}

    def measure(relay_ids: List[str]) -> Tuple[List[str], List[Tuple[str, str, float]], float]:
        rid = sorted(relay_ids, key=lambda i: by_id[i].s)
        chain = [virtual.id, *rid, lead.id]
        hops = _hops_along_chain(chain, by_id, model)
        return chain, hops, _e2e_quality(hops)

    relay_ids = sorted(relays)
    guard = 0
    while guard < 14:
        guard += 1
        _, hops, q = measure(relay_ids)
        if q >= 1.0 - relay_loss_threshold:
            ingress = 1.0 - hops[0][2] if hops else q
            return RelayPlanResult(
                ordered_relay_ids=sorted(relay_ids, key=lambda i: by_id[i].s),
                chain_path=["entrance", *[i for i in sorted(relay_ids, key=lambda x: by_id[x].s)], lead.id],
                ingress_quality=float(ingress),
                lead_quality=float(q),
                notes=notes,
            )
        standbys = [
            n
            for n in nodes
            if n.id not in relays and n.id != lead.id and n.connectivity != "offline"
        ]
        if not standbys:
            notes.append("no standby candidates")
            break
        best: Optional[SimNode] = None
        best_score = -1.0
        for n in standbys:
            sc = _relay_candidate_score(n, lead, geom)
            if sc > best_score:
                best_score = sc
                best = n
        if best is None:
            break
        relays.add(best.id)
        relay_ids = sorted(relays)
        notes.append(f"plan adds {best.id} score={best_score:.2f}")

    _, hops, q = measure(relay_ids)
    ingress = 1.0 - hops[0][2] if hops else q
    return RelayPlanResult(
        ordered_relay_ids=sorted(relay_ids, key=lambda i: by_id[i].s),
        chain_path=["entrance", *[i for i in sorted(relay_ids, key=lambda x: by_id[x].s)], lead.id],
        ingress_quality=float(ingress),
        lead_quality=float(q),
        notes=notes,
    )
