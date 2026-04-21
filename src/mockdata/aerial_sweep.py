"""Coarse lawnmower sweep over a rectangular field (aerial fast grid)."""

from __future__ import annotations

import math
from typing import List, Tuple

Vec3 = Tuple[float, float, float]


def build_lawnmower_path(
    xmin: float,
    xmax: float,
    zmin: float,
    zmax: float,
    stripe_m: float,
    altitude: float,
    margin: float = 8.0,
) -> List[Vec3]:
    """Axis-aligned stripes along +X, alternating Z rows (meters, Y-up)."""
    x0, x1 = xmin + margin, xmax - margin
    z0, z1 = zmin + margin, zmax - margin
    if x1 <= x0 or z1 <= z0:
        return [(0.0, altitude, 0.0)]
    rows: List[float] = []
    z = z0
    while z <= z1 + 1e-6:
        rows.append(min(z, z1))
        z += stripe_m
    path: List[Vec3] = []
    flip = False
    for rz in rows:
        xa, xb = (x1, x0) if flip else (x0, x1)
        if not path or (path[-1][0], path[-1][2]) != (xa, rz):
            path.append((xa, altitude, rz))
        path.append((xb, altitude, rz))
        flip = not flip
    return path


def yaw_toward(from_pos: Vec3, to_pos: Vec3) -> float:
    """Heading about +Y for mock FOV (degrees from +X in XZ)."""
    dx = to_pos[0] - from_pos[0]
    dz = to_pos[2] - from_pos[2]
    return math.degrees(math.atan2(dz, dx))
