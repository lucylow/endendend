"""P2P bid scoring: distance × battery × capacity (Vertex-style mock)."""

from __future__ import annotations

from typing import Tuple

from mockdata.rover_paths import xz_distance

Vec3 = Tuple[float, float, float]


def calculate_bid_score(
    rover_position: Vec3,
    rover_battery_pct: float,
    rover_capacity: str,
    victim_coords: Vec3,
) -> Tuple[float, float]:
    dist = max(0.5, xz_distance(rover_position, victim_coords))
    dist_score = 1.0 / dist
    battery_score = min(max(rover_battery_pct, 0.0) / 100.0, 1.0)
    cap = rover_capacity.lower()
    capacity_score = 2.0 if cap == "heavy" else 1.0
    score = dist_score * battery_score * capacity_score
    return score, dist
