"""Serialize engine state to the JSON shape consumed by the Track 2 browser store."""

from __future__ import annotations

from typing import Any, Dict, List, TYPE_CHECKING

if TYPE_CHECKING:
    from mockdata.engine import MockDataEngine


def engine_to_track2_frame(engine: "MockDataEngine") -> Dict[str, Any]:
    rovers: List[Dict[str, Any]] = []
    for r in engine.rovers:
        rovers.append(
            {
                "id": r.id,
                "position": list(r.position),
                "battery": round(r.battery, 2),
                "state": r.state,
                "sector": {"bounds": list(r.sector)},
            }
        )
    return {
        "time": round(engine.t, 3),
        "global_map": engine.global_map,
        "reallocated": engine.reallocated_flag,
        "rovers": rovers,
    }
