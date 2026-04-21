"""Typed structures for Fallen Comrade world + rover payloads (JSON-friendly)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Set, Tuple

RoverStatus = Literal["exploring", "reallocating", "dead", "idle"]


@dataclass
class Sector:
    rover_id: str
    xmin: float
    xmax: float
    ymin: float
    ymax: float

    def as_bounds(self) -> Tuple[float, float, float, float]:
        return (self.xmin, self.xmax, self.ymin, self.ymax)


@dataclass
class Victim:
    victim_id: str
    x: float
    y: float
    severity: int
    discovered: bool = False

    def to_json(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RoverTelemetry:
    rover_id: str
    status: RoverStatus
    x: float
    y: float
    z: float
    battery: float
    speed_mps: float
    heartbeat_sim_s: float
    explored_unique_cells: int
    task: str
    assigned_victims: List[str] = field(default_factory=list)


def explored_cells_to_lists(cells: Set[Tuple[int, int]]) -> List[List[int]]:
    return [list(c) for c in sorted(cells)]

