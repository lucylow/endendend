"""Small numeric helpers (no heavy deps)."""

from __future__ import annotations

from typing import List, Tuple


def cells_from_footprint(gx: int, gz: int, radius_cells: int) -> List[Tuple[int, int]]:
    """Return grid cells covered by a square footprint centered on (gx, gz)."""
    r = max(0, int(radius_cells))
    out: List[Tuple[int, int]] = []
    for dz in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out.append((gx + dx, gz + dz))
    return out


def clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t
