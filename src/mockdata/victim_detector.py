"""Mock coarse aerial sensor: range + horizontal FOV cone in XZ."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

Vec3 = Tuple[float, float, float]


def _normalize_deg(a: float) -> float:
    while a > 180.0:
        a -= 360.0
    while a < -180.0:
        a += 360.0
    return a


def angle_to_target_deg(from_pos: Vec3, heading_deg: float, target: Vec3) -> float:
    dx = target[0] - from_pos[0]
    dz = target[2] - from_pos[2]
    bearing = math.degrees(math.atan2(dz, dx))
    return abs(_normalize_deg(bearing - heading_deg))


def detect_victim(
    aerial_pos: Vec3,
    heading_deg: float,
    victims: List[Dict[str, Any]],
    max_range_m: float = 50.0,
    fov_deg: float = 30.0,
) -> Optional[Dict[str, Any]]:
    """Return first victim in FOV+range (deterministic order = list order)."""
    ax, ay, az = aerial_pos
    for v in victims:
        pos = v.get("pos")
        if not isinstance(pos, (list, tuple)) or len(pos) < 3:
            continue
        tx, ty, tz = float(pos[0]), float(pos[1]), float(pos[2])
        dist = math.sqrt((tx - ax) ** 2 + (ty - ay) ** 2 + (tz - az) ** 2)
        if dist > max_range_m:
            continue
        ang = angle_to_target_deg(aerial_pos, heading_deg, (tx, ty, tz))
        if ang <= fov_deg / 2.0 + 1e-6:
            return {
                "coords": [tx, ty, tz],
                "confidence": min(0.99, 0.72 + (1.0 - dist / max_range_m) * 0.25),
                "type": v.get("type", "human"),
                "victim_id": v.get("id", "unknown"),
            }
    return None
