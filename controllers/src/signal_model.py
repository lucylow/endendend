"""Depth- and geometry-aware RF link model (stdlib only, sub-ms per hop)."""

from __future__ import annotations

import math
import random
from typing import Any, Dict, Tuple

from tunnel_geometry import TunnelGeometry, segment_loss_mul


Vec3 = Tuple[float, float, float]


class TunnelSignalModel:
    """Maps 3D positions to link quality; ``depth`` axis is tunnel advance ``s`` (Z in Webots world)."""

    def __init__(self, geom: TunnelGeometry, rng: random.Random | None = None) -> None:
        self.geom = geom
        self.depth = geom.length_m
        self.rng = rng or random.Random(0)
        self.obstacles = list(geom.collapse_points)

    def obstacle_shadow(self, s: float) -> float:
        """0–1 extra shadowing near collapse points."""
        v = 0.0
        for c in self.obstacles:
            d = abs(s - c)
            if d < 18.0:
                v = max(v, 1.0 - d / 18.0)
        return min(1.0, v)

    def link_quality(self, drone_a: Vec3, drone_b: Vec3) -> Dict[str, Any]:
        ax, ay, az = drone_a
        bx, by, bz = drone_b
        dist = math.hypot(ax - bx, ay - by, az - bz)
        s_a, s_b = az, bz
        depth_mean = max(0.0, min(self.depth, (s_a + s_b) * 0.5))
        depth_factor = depth_mean / max(self.depth, 1e-6)
        seg_mul = math.sqrt(max(0.05, segment_loss_mul(self.geom, s_a) * segment_loss_mul(self.geom, s_b)))
        base_loss = 0.008 * dist
        tunnel_loss = depth_factor * (0.22 + 0.62 * self.obstacle_shadow(depth_mean)) * seg_mul
        shadow_boost = 0.12 * self.obstacle_shadow((s_a + s_b) * 0.5)
        loss = min(0.96, base_loss + tunnel_loss + shadow_boost)
        flutter = (self.rng.random() - 0.5) * 0.05 * (0.35 + depth_factor)
        loss = min(0.97, max(0.0, loss + flutter))
        quality = max(0.0, 1.0 - loss)
        jitter_ms = (4.0 + dist * 0.05 + self.rng.random() * 30.0 * depth_factor) * (1.0 + seg_mul * 0.25)
        return {
            "quality": quality,
            "loss": 1.0 - quality,
            "jitter_ms": jitter_ms,
            "reachable": quality > 0.1,
        }
