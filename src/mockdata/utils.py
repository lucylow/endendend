"""Small deterministic helpers for grid + serialization."""

from __future__ import annotations

from typing import Iterable, Tuple

Cell = Tuple[int, int]


def clamp_cell(cx: int, cz: int, grid_size: int = 100) -> Cell | None:
    if 0 <= cx < grid_size and 0 <= cz < grid_size:
        return (cx, cz)
    return None


def cells_from_footprint(gx: int, gz: int, radius: int = 1, grid_size: int = 100) -> Iterable[Cell]:
    for ox in range(-radius, radius + 1):
        for oz in range(-radius, radius + 1):
            c = clamp_cell(gx + ox, gz + oz, grid_size)
            if c:
                yield c
