"""One-tick orchestration: geometry, relays, map, scripted failure, motion targets."""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple

from chain_manager import ChainManager
from mission_phases import mission_phase
from relay_planner import SimNode, plan_relay_chain
from signal_model import TunnelSignalModel
from target_discovery import spawn_victims
from tunnel_geometry import build_tunnel_geometry
from tunnel_map import TunnelMap
from ws_track2_payload import track2_payload

from drones.base import make_initial_nodes


@dataclass
class DynamicDaisyEngine:
    seed: int = 42
    rng: random.Random = field(default_factory=random.Random)
    geom: Any = None
    signal: TunnelSignalModel | None = None
    tunnel_map: TunnelMap | None = None
    chain: ChainManager = field(default_factory=ChainManager)
    t: float = 0.0
    nodes: List[SimNode] = field(default_factory=list)
    victims: List[float] = field(default_factory=list)
    _failure_fired: bool = False
    relay_loss_threshold: float = 0.42

    def __post_init__(self) -> None:
        self.rng = random.Random(self.seed)
        self.geom = build_tunnel_geometry(self.seed)
        self.signal = TunnelSignalModel(self.geom, self.rng)
        self.tunnel_map = TunnelMap(int(self.geom.length_m))
        self.nodes = make_initial_nodes()
        self.victims = spawn_victims(self.geom, self.rng, 4)
        if self.tunnel_map:
            self.tunnel_map.mark_targets(self.victims)

    def _sync_nodes_from_webots(self, positions: Dict[str, Tuple[float, float, float]]) -> SimNode:
        lead = self.nodes[0]
        for n in self.nodes:
            if n.id in positions:
                x, y, z = positions[n.id]
                n.s = max(0.0, z)
                n.lateral = x
        return lead

    def _maybe_scripted_failure(self) -> None:
        if self._failure_fired or self.t < 118.0:
            return
        for n in self.nodes:
            if n.id == "drone_1":
                n.connectivity = "offline"
                n.battery = 0.0
                break
        self._failure_fired = True

    def _explorer_target_s(self, lead: SimNode, plan_lead_quality: float) -> float:
        assert self.geom is not None
        cap = self.geom.length_m - 4.0
        rate = 1.0 if plan_lead_quality > 0.35 else 0.35
        ideal = min(cap, max(lead.s, self.t * 0.95 * rate))
        return ideal

    def _relay_targets(
        self, plan_path: List[str], lead_s: float
    ) -> Dict[str, Tuple[float, float]]:
        """Return target (x, z) per id."""
        assert self.geom is not None
        out: Dict[str, Tuple[float, float]] = {}
        relays = [p for p in plan_path if p not in ("entrance", "drone_0") and p.startswith("drone_")]
        if not relays:
            return out
        for i, rid in enumerate(sorted(relays, key=lambda r: self._node_by_id(r).s)):
            frac = (i + 1) / (len(relays) + 1)
            tgt_s = self.geom.entrance_s + frac * max(8.0, lead_s - self.geom.entrance_s)
            node = self._node_by_id(rid)
            out[rid] = (node.lateral * 0.4, tgt_s)
        return out

    def _node_by_id(self, nid: str) -> SimNode:
        for n in self.nodes:
            if n.id == nid:
                return n
        return self.nodes[0]

    def compute_motion_targets(self, plan_path: List[str], lead_s: float, lead_quality: float) -> Dict[str, Dict[str, float]]:
        tgt: Dict[str, Dict[str, float]] = {}
        ideal_s = self._explorer_target_s(self.nodes[0], lead_quality)
        tgt["drone_0"] = {"target_x": 0.0, "target_z": float(ideal_s), "role": "lead_explorer"}
        rz = self._relay_targets(plan_path, lead_s)
        for rid, (tx, tz) in rz.items():
            tgt[rid] = {"target_x": float(tx), "target_z": float(tz), "role": "relay"}
        for n in self.nodes:
            if n.id in tgt or n.connectivity == "offline":
                continue
            tgt[n.id] = {
                "target_x": float(n.lateral) * 0.5,
                "target_z": float(min(25.0 + self.t * 0.05, lead_s * 0.35)),
                "role": "standby",
            }
        return tgt

    def tick(
        self,
        dt: float,
        positions: Dict[str, Tuple[float, float, float]],
    ) -> Tuple[Dict[str, Any], Dict[str, Dict[str, float]]]:
        self.t += dt
        assert self.signal and self.tunnel_map and self.geom
        lead = self._sync_nodes_from_webots(positions)
        self._maybe_scripted_failure()

        plan = plan_relay_chain(
            self.nodes,
            lead,
            self.geom,
            self.signal,
            self.relay_loss_threshold,
            self.rng,
        )
        self.chain.set_from_plan(plan.chain_path)

        partitioned = plan.lead_quality < 1.0 - 0.82
        phase = mission_phase(plan.ingress_quality, partitioned, self.t)

        self.tunnel_map.mark_explored(0.0, lead.s, 2)
        for vs in self.victims:
            if lead.s + 1.5 >= vs:
                self.tunnel_map.mark_explored(vs - 1, vs + 1, 4)

        for n in self.nodes:
            drain = 0.018 if n.id == "drone_0" else 0.012 if n.id in plan.ordered_relay_ids else 0.005
            n.battery = max(0.0, n.battery - drain * dt)

        signal_per_node: Dict[str, float] = {}
        hop_edges: Dict[str, float] = {}
        for n in self.nodes:
            signal_per_node[n.id] = max(0.05, plan.ingress_quality * (0.85 + 0.15 * (n.battery / 100.0)))

        id_chain = ["__entrance__", *plan.ordered_relay_ids, lead.id]
        by_id: Dict[str, SimNode] = {n.id: n for n in self.nodes}
        by_id["__entrance__"] = SimNode(
            id="__entrance__",
            s=self.geom.entrance_s,
            lateral=0.0,
            battery=100.0,
            relay_suitability=1.0,
            explorer_suitability=0.0,
            tunnel_suitability=1.0,
            is_relay=True,
            connectivity="online",
            forward_load=0.0,
        )
        for i in range(len(id_chain) - 1):
            a = by_id[id_chain[i]]
            b = by_id[id_chain[i + 1]]
            pa = (a.lateral, 2.0, a.s)
            pb = (b.lateral, 2.0, b.s)
            q = self.signal.link_quality(pa, pb)
            hop_edges[f"{a.id}->{b.id}"] = float(q["quality"])

        payload = track2_payload(
            self.t,
            self.nodes,
            plan,
            self.tunnel_map,
            positions,
            signal_per_node,
            hop_edges,
        )
        payload["phase"] = phase
        payload["partitioned"] = partitioned
        motion = self.compute_motion_targets(plan.chain_path, lead.s, plan.lead_quality)
        return payload, motion

    def write_targets_file(self, root: Path, motion: Dict[str, Dict[str, float]]) -> None:
        p = root / "webots" / "maps" / "dynamic_daisy_targets.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"t": self.t, "targets": motion}, indent=2), encoding="utf-8")
