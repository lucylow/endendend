"""Optional bridge: wire-format victim dicts → plain state structs for dashboards."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple


@dataclass
class VictimState:
    track_id: int
    world_xyz: Tuple[float, float, float]
    confidence: float
    bbox: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)


@dataclass
class TashiVisionState:
    victims: List[VictimState] = field(default_factory=list)


def wire_payloads_to_state(payloads: List[Dict[str, Any]]) -> TashiVisionState:
    victims: List[VictimState] = []
    for p in payloads:
        if p.get("type") != "VICTIM_DETECTED":
            continue
        loc = p.get("location") or [0, 0, 0]
        bb = p.get("bbox") or [0, 0, 0, 0]
        victims.append(
            VictimState(
                track_id=int(p.get("track_id", -1)),
                world_xyz=(float(loc[0]), float(loc[1]), float(loc[2])),
                confidence=float(p.get("confidence", 0.0)),
                bbox=(float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])),
            )
        )
    return TashiVisionState(victims=victims)
