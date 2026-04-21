"""Simple ground steering on XZ toward a goal (mock pathfinding)."""

from __future__ import annotations

import math
from typing import List, Tuple

Vec3 = Tuple[float, float, float]


def xz_distance(a: Vec3, b: Vec3) -> float:
    dx = a[0] - b[0]
    dz = a[2] - b[2]
    return math.hypot(dx, dz)


def step_toward(current: Vec3, goal: Vec3, speed_m_s: float, dt: float, y_floor: float = 0.35) -> Vec3:
    """Move at most `speed * dt` meters along XZ toward goal; keep Y on ground plane."""
    dx = goal[0] - current[0]
    dz = goal[2] - current[2]
    dist = math.hypot(dx, dz)
    if dist < 1e-6:
        return (goal[0], y_floor, goal[2])
    step = min(speed_m_s * dt, dist)
    ux, uz = dx / dist, dz / dist
    nx = current[0] + ux * step
    nz = current[2] + uz * step
    return (nx, y_floor, nz)


def lawnmower_segment_progress(path: List[Vec3], distance_along: float) -> Vec3:
    """Return position after walking `distance_along` meters along polyline `path`."""
    if not path:
        return (0.0, 20.0, 0.0)
    remaining = max(0.0, distance_along)
    for i in range(len(path) - 1):
        a, b = path[i], path[i + 1]
        seg = xz_distance(a, b)
        if remaining <= seg:
            t = remaining / seg if seg > 1e-9 else 0.0
            y = a[1] + (b[1] - a[1]) * t
            x = a[0] + (b[0] - a[0]) * t
            z = a[2] + (b[2] - a[2]) * t
            return (x, y, z)
        remaining -= seg
    last = path[-1]
    return (last[0], last[1], last[2])
