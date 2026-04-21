"""Light validation for generated world JSON."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def _is_bounds(b: Any) -> bool:
    return isinstance(b, list) and len(b) == 4 and all(isinstance(x, (int, float)) for x in b)


def validate_blind_handoff_world(world: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errs: List[str] = []
    if not _is_bounds(world.get("bounds")):
        errs.append("bounds must be [xmin,xmax,zmin,zmax]")
    victims = world.get("victims")
    if not isinstance(victims, list) or not victims:
        errs.append("victims must be a non-empty list")
    else:
        for i, v in enumerate(victims):
            if not isinstance(v, dict):
                errs.append(f"victims[{i}] must be object")
                continue
            if "pos" not in v and ("x" not in v or "z" not in v):
                errs.append(f"victims[{i}] needs pos or x/z")
    if "aerial_start" not in world:
        errs.append("missing aerial_start")
    gs = world.get("ground_starts")
    if not isinstance(gs, list) or len(gs) < 3:
        errs.append("ground_starts must list at least 3 bases")
    return (len(errs) == 0, errs)
