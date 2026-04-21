"""Sanity checks for generated Fallen Comrade artifacts."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def validate_world_bundle(world: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errs: List[str] = []
    grid = world.get("grid")
    if not isinstance(grid, list) or len(grid) != 100:
        errs.append("grid must be 100x100 list")
    else:
        for i, row in enumerate(grid):
            if not isinstance(row, list) or len(row) != 100:
                errs.append(f"grid row {i} invalid length")
                break
    sectors = world.get("sectors")
    if not isinstance(sectors, dict) or len(sectors) != 5:
        errs.append("sectors must be a dict of 5 rovers")
    victims = world.get("victims")
    if not isinstance(victims, list) or not (8 <= len(victims) <= 12):
        errs.append("victims must be list length 8..12")
    return (len(errs) == 0, errs)
