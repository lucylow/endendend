"""Place 8–12 victims on free cells away from obstacles."""

from __future__ import annotations

import random
from typing import Any, Dict, List, Sequence, Tuple

Cell = int


def spawn_victims(
    grid: Sequence[Sequence[Cell]],
    rng: random.Random,
    count: int | None = None,
) -> List[Dict[str, Any]]:
    """Return victims as {x, z} meter positions (cell centers)."""
    n = len(grid)
    free: List[Tuple[int, int]] = []
    for z in range(n):
        row = grid[z]
        for x in range(len(row)):
            if row[x] == 0:
                free.append((x, z))
    rng.shuffle(free)
    k = count if count is not None else rng.randint(8, 12)
    k = min(k, len(free))
    victims: List[Dict[str, Any]] = []
    for i in range(k):
        cx, cz = free[i]
        victims.append(
            {
                "id": f"victim_{i + 1}",
                "x": cx + 0.5,
                "z": cz + 0.5,
                "severity": float(rng.randint(1, 4)),
                "discovered": False,
            }
        )
    return victims
