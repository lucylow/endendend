"""Configuration dataclasses for Track 2 mock engines."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FallenComradeConfig:
    """Heartbeat / comm-loss timeline for the Fallen Comrade sector mock."""

    seed: int = 42
    rover_b_comm_loss_start_s: float = 27.0
    rover_c_comm_loss_start_s: float = 117.0
    heartbeat_timeout_s: float = 3.0
    speed_mps: float = 1.2


@dataclass(frozen=True)
class BlindHandoffConfig:
    """Tunable Blind Handoff air/ground field + telemetry cadence."""

    seed: int = 42
    world_size_m: int = 200
    half_extent_m: int = 100
    victim_count_min: int = 5
    victim_count_max: int = 8
    aerial_speed_m_s: float = 8.0
    aerial_altitude_m: float = 20.0
    aerial_battery_start: float = 100.0
    low_battery_threshold: float = 20.0
    auction_deadline_sec: float = 60.0
    rover_speed_light_m_s: float = 2.0
    rover_speed_heavy_m_s: float = 2.5
    update_hz: int = 60
