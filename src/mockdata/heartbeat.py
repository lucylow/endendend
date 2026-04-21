"""Heartbeat staleness rules (FoxMQ / mesh stand-in)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mockdata import rover_states


class HeartbeatMonitor:
    def __init__(self, timeout_sec: float = 3.0) -> None:
        self.timeout_sec = timeout_sec

    def is_stale(self, rover: "rover_states.RoverState", sim_time: float) -> bool:
        if rover.state == "dead":
            return False
        return (sim_time - rover.heartbeat) > self.timeout_sec
