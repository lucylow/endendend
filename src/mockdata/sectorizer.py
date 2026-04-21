"""Five non-overlapping 20x20m sectors (1m cells) along the south edge of a 100x100 world."""

from __future__ import annotations

from typing import Dict, List, Tuple

Bounds = Tuple[float, float, float, float]  # xmin, xmax, zmin, zmax

ROVER_IDS = ("RoverA", "RoverB", "RoverC", "RoverD", "RoverE")


def initial_sectors_100() -> Dict[str, Bounds]:
    """Five 20x20 tiles covering the strip z in [0,20), x in [0,100)."""
    out: Dict[str, Bounds] = {}
    for i, rid in enumerate(ROVER_IDS):
        x0 = float(i * 20)
        x1 = x0 + 20.0
        out[rid] = (x0, x1, 0.0, 20.0)
    return out


def sector_center(bounds: Bounds) -> Tuple[float, float, float]:
    xmin, xmax, zmin, zmax = bounds
    return ((xmin + xmax) / 2.0, 0.5, (zmin + zmax) / 2.0)


def cells_in_bounds(bounds: Bounds, grid_size: int = 100) -> List[Tuple[int, int]]:
    xmin, xmax, zmin, zmax = bounds
    x0 = max(0, int(xmin))
    x1 = min(grid_size, int(xmax) + 1)
    z0 = max(0, int(zmin))
    z1 = min(grid_size, int(zmax) + 1)
    cells: List[Tuple[int, int]] = []
    for z in range(z0, z1):
        for x in range(x0, x1):
            cells.append((x, z))
    return cells
