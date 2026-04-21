"""Scenario constants for the Fallen Comrade Track 2 mock engine."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FallenComradeConfig:
    """Deterministic defaults; Webots + WS hub read the same numbers."""

    seed: int = 42
    grid_size: int = 100
    cell_size_m: float = 1.0
    rover_count: int = 5
    # RoverB stops updating heartbeats at this sim time; declared dead once gap exceeds timeout.
    rover_b_comm_loss_start_s: float = 27.0
    rover_c_comm_loss_start_s: float = 117.0
    heartbeat_timeout_s: float = 3.0
    update_hz: float = 60.0
    speed_mps: float = 1.2
    victim_count_min: int = 8
    victim_count_max: int = 12

    @property
    def rover_b_expected_dead_s(self) -> float:
        return self.rover_b_comm_loss_start_s + self.heartbeat_timeout_s
