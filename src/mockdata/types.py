"""Stable, JSON-friendly shapes shared by engine, validators, and UI."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple

AgentType = Literal["aerial", "ground"]
AgentStatus = Literal["sweeping", "waiting", "bidding", "assigned", "rtb", "rescuing", "complete"]


@dataclass
class Victim:
    victim_id: str
    x: float
    y: float
    z: float = 0.0
    severity: int = 3
    detected: bool = False
    rescued: bool = False


@dataclass
class AgentState:
    agent_id: str
    agent_type: AgentType
    x: float
    y: float
    z: float = 0.0
    battery: float = 100.0
    speed: float = 0.0
    status: AgentStatus = "waiting"
    target: Optional[Tuple[float, float, float]] = None
    capacity: str = "standard"
    confidence: float = 0.0
    meta: Dict[str, object] = field(default_factory=dict)


def victim_from_world_row(row: Dict[str, object]) -> Victim:
    vid = str(row.get("id", "victim"))
    pos = row.get("pos")
    if isinstance(pos, (list, tuple)) and len(pos) >= 3:
        x, y, z = float(pos[0]), float(pos[1]), float(pos[2])
    else:
        x = float(row.get("x", 0.0))
        y = float(row.get("y", 0.0))
        z = float(row.get("z", 0.0))
    sev = row.get("severity", 3)
    severity = int(sev) if isinstance(sev, (int, float)) else 3
    return Victim(victim_id=vid, x=x, y=y, z=z, severity=severity)
