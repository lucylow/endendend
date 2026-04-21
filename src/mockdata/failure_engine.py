"""Timeline constants for heartbeat loss and committed failure."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, List

if TYPE_CHECKING:
    from mockdata import rover_states


@dataclass(frozen=True)
class FailureConfig:
    """RoverB: last heartbeat update before comm loss; dead at +heartbeat_timeout (default T+30s)."""

    stop_heartbeat_b: float = 27.0
    stop_heartbeat_c: float = 117.0
    heartbeat_timeout_s: float = 3.0


class FailureEngine:
    """Schedules RoverB / RoverC silent periods; `MockDataEngine` applies timeouts."""

    def __init__(self, cfg: FailureConfig | None = None) -> None:
        self.cfg = cfg or FailureConfig()

    def rover_should_stop_heartbeat(self, rover_id: str, sim_time: float, *, enable_c: bool) -> bool:
        if rover_id == "RoverB" and sim_time >= self.cfg.stop_heartbeat_b:
            return True
        if rover_id == "RoverC" and enable_c and sim_time >= self.cfg.stop_heartbeat_c:
            return True
        return False

    def survivors_for_realloc(self, rovers: List["rover_states.RoverState"], dead_id: str) -> List["rover_states.RoverState"]:
        return [r for r in rovers if r.state != "dead" and r.id != dead_id]
