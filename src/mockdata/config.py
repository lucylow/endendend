"""Single source of truth for Blind Handoff mock tuning (deterministic + Webots-friendly)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BlindHandoffConfig:
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
