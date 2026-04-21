"""Heterogeneous swarm profiles (Explorer / Relay / Indoor / Heavy / Backup)."""

from __future__ import annotations

from typing import Dict, List

from relay_planner import SimNode


DRONE_PROFILES: Dict[str, Dict[str, float]] = {
    "explorer": {
        "relay": 0.25,
        "explorer": 0.98,
        "tunnel": 0.92,
        "speed": 2.2,
    },
    "relay": {
        "relay": 0.96,
        "explorer": 0.35,
        "tunnel": 0.88,
        "speed": 0.9,
    },
    "indoor": {
        "relay": 0.55,
        "explorer": 0.45,
        "tunnel": 0.95,
        "speed": 0.65,
    },
    "heavy": {
        "relay": 0.62,
        "explorer": 0.5,
        "tunnel": 0.9,
        "speed": 0.75,
    },
    "backup": {
        "relay": 0.88,
        "explorer": 0.55,
        "tunnel": 0.9,
        "speed": 1.1,
    },
}


def make_initial_nodes() -> List[SimNode]:
    """Default Track 2 lineup: heterogeneous IDs ``drone_0`` … ``drone_4``."""
    specs = [
        ("drone_0", "explorer", 0.0, 0.0),
        ("drone_1", "relay", 0.0, 2.0),
        ("drone_2", "indoor", 0.0, -2.0),
        ("drone_3", "heavy", 0.0, 4.0),
        ("drone_4", "backup", 0.0, -4.0),
    ]
    nodes: List[SimNode] = []
    for nid, role, s, lat in specs:
        p = DRONE_PROFILES[role]
        nodes.append(
            SimNode(
                id=nid,
                s=s,
                lateral=lat,
                battery=100.0,
                relay_suitability=p["relay"],
                explorer_suitability=p["explorer"],
                tunnel_suitability=p["tunnel"],
                is_relay=False,
                connectivity="online",
                forward_load=0.08 if role == "relay" else 0.02,
            )
        )
    return nodes
