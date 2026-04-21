"""Typed agent snapshots for blind handoff mock (aerial + ground)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

Vec3 = Tuple[float, float, float]


@dataclass
class AerialDroneState:
    id: str = "Aerial1"
    position: List[float] = field(default_factory=lambda: [-80.0, 20.0, -80.0])
    battery: float = 100.0
    speed_m_s: float = 8.0
    altitude: float = 20.0
    sweep_pattern: str = "lawnmower"
    heading_deg: float = 0.0
    victim_detected: Optional[Dict[str, Any]] = None
    mode: str = "sweep"  # sweep | rtb

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": "aerial",
            "position": list(self.position),
            "battery": round(self.battery, 2),
            "speed_m_s": self.speed_m_s,
            "altitude": self.altitude,
            "sweep_pattern": self.sweep_pattern,
            "heading_deg": round(self.heading_deg, 2),
            "victim_detected": self.victim_detected,
            "mode": self.mode,
        }


@dataclass
class GroundRoverState:
    id: str
    position: List[float]
    capacity: str
    battery: float = 100.0
    speed_m_s: float = 2.5
    current_task: Optional[str] = None

    @staticmethod
    def from_meta(start: List[float], meta: Dict[str, Any], speed: float) -> "GroundRoverState":
        cap = meta.get("capacity", "light")
        rid = str(meta.get("id", "Rover1"))
        return GroundRoverState(
            id=rid,
            position=[float(start[0]), float(start[1]), float(start[2])],
            capacity=cap,
            speed_m_s=speed,
        )

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": "ground",
            "capacity": self.capacity,
            "position": list(self.position),
            "battery": round(self.battery, 2),
            "speed_m_s": self.speed_m_s,
            "current_task": self.current_task,
        }
