"""Procedural victim sites in deep tunnel zones."""

from __future__ import annotations

import random
from typing import List, Tuple

from tunnel_geometry import TunnelGeometry


def spawn_victims(geom: TunnelGeometry, rng: random.Random, count: int = 4) -> List[float]:
    out: List[float] = []
    zones = list(geom.target_zones) or [(geom.length_m * 0.65, geom.length_m * 0.85, "default")]
    for i in range(count):
        z0, z1, _ = zones[i % len(zones)]
        s = z0 + (z1 - z0) * rng.random()
        out.append(s)
    return sorted(out)
