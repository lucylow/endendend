"""Build ``useSwarmStore`` / WebSocket JSON from engine state."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from relay_planner import RelayPlanResult, SimNode
from tunnel_map import TunnelMap


def global_map_rows(tunnel: TunnelMap) -> List[List[int]]:
    return [list(tunnel.cells)]


def track2_payload(
    t: float,
    nodes: List[SimNode],
    plan: RelayPlanResult,
    tunnel: TunnelMap,
    positions: Dict[str, Tuple[float, float, float]],
    signal_per_node: Dict[str, float],
    hop_edges: Dict[str, float],
) -> Dict[str, Any]:
    rovers = []
    for n in nodes:
        pos = positions.get(n.id, (n.lateral, 2.0, n.s))
        st = "dead" if n.connectivity == "offline" else "exploring"
        rovers.append(
            {
                "id": n.id,
                "position": [float(pos[0]), float(pos[1]), float(pos[2])],
                "battery": float(n.battery),
                "state": st,
                "sector": {"bounds": [-12.0, 12.0, -5.0, float(tunnel.length_m)]},
            }
        )
    lead = next((x for x in nodes if x.id == "drone_0"), nodes[0])
    sig = {**signal_per_node, **hop_edges}
    return {
        "time": float(t),
        "tunnel_depth": float(lead.s),
        "relay_chain": plan.chain_path,
        "signal_quality": sig,
        "global_map": global_map_rows(tunnel),
        "rovers": rovers,
        "rescues_completed": sum(1 for c in tunnel.cells if c >= 4),
    }
