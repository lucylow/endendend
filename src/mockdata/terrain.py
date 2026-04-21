"""Collapsed-tunnel style obstacle masks on the 1m-resolution grid."""

from __future__ import annotations

import random
from typing import Any, Dict, List, Sequence, Tuple

Cell = int  # 0 free, 1 obstacle


def place_tunnel_collapse(grid: List[List[Cell]], rng: random.Random) -> List[Dict[str, Any]]:
    """
    Deterministic primary corridor collapse (challenge brief) plus small seeded rubble.
    Grid indices: grid[z][x] with z as north-south axis in Webots ground plane.
    """
    n = len(grid)
    obstacles: List[Dict[str, Any]] = []

    for x in range(38, 62):
        for z in range(45, 55):
            grid[z][x] = 1
            obstacles.append({"x": x, "z": z, "type": "collapse"})

    def stamp(cx: int, cz: int, w: int, h: int) -> None:
        x0 = max(0, cx - w // 2)
        z0 = max(0, cz - h // 2)
        for x in range(x0, min(n, x0 + w)):
            for z in range(z0, min(n, z0 + h)):
                if grid[z][x] == 0:
                    grid[z][x] = 1
                    obstacles.append({"x": x, "z": z, "type": "rubble"})

    stamp(n // 3, 2 * n // 3, 8, 6)
    for _ in range(rng.randint(2, 3)):
        stamp(rng.randint(10, n - 10), rng.randint(10, n - 10), rng.randint(3, 6), rng.randint(3, 6))

    return obstacles


def obstacle_cells(grid: Sequence[Sequence[Cell]]) -> List[Tuple[int, int]]:
    out: List[Tuple[int, int]] = []
    for z, row in enumerate(grid):
        for x, v in enumerate(row):
            if v:
                out.append((x, z))
    return out
