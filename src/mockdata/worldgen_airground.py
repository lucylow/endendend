"""200×200 m open field: aerial start, ground rover bases, procedural victims, light terrain."""

from __future__ import annotations

import json
import math
import random
from typing import Any, Dict, List, Tuple

from mockdata import handoff_protocol
from mockdata.aerial_sweep import build_lawnmower_path

Vec3 = Tuple[float, float, float]


def _terrain_height(x: float, z: float, seed: int) -> float:
    """Smooth hills without numpy (meters, subtle)."""
    s = 0.011 * (1 + (seed % 7) * 0.01)
    return 1.8 * math.sin(s * x + seed) * math.cos(s * z * 1.1 - seed * 0.02)


class AirGroundWorld:
    """Hybrid air/ground Track 2 blind handoff field."""

    def __init__(self, bounds: Tuple[float, float, float, float] = (-100.0, 100.0, -100.0, 100.0)) -> None:
        self.bounds = bounds  # xmin,xmax,zmin,zmax

    def terrain_sample_grid(self, seed: int, nx: int = 33, nz: int = 33) -> List[List[float]]:
        xmin, xmax, zmin, zmax = self.bounds
        rows: List[List[float]] = []
        for j in range(nz):
            z = zmin + (zmax - zmin) * j / max(1, nz - 1)
            row: List[float] = []
            for i in range(nx):
                x = xmin + (xmax - xmin) * i / max(1, nx - 1)
                row.append(round(_terrain_height(x, z, seed), 3))
            rows.append(row)
        return rows

    def spawn_victims(self, rng: random.Random, count: int | None = None) -> List[Dict[str, Any]]:
        xmin, xmax, zmin, zmax = self.bounds
        k = count if count is not None else rng.randint(5, 8)
        victims: List[Dict[str, Any]] = []
        for i in range(k):
            x = rng.uniform(xmin + 12, xmax - 12)
            z = rng.uniform(zmin + 12, zmax - 12)
            y = 0.65 + _terrain_height(x, z, rng.randint(0, 10_000))
            victims.append(
                {
                    "id": f"victim_{i + 1}",
                    "pos": [round(x, 2), round(y, 2), round(z, 2)],
                    "type": "human",
                }
            )
        return victims

    def generate(self, seed: int = 42) -> Dict[str, Any]:
        rng = random.Random(seed)
        xmin, xmax, zmin, zmax = self.bounds
        victims = self.spawn_victims(rng)
        altitude = 20.0
        sweep = build_lawnmower_path(xmin, xmax, zmin, zmax, stripe_m=14.0, altitude=altitude)
        aerial_start: Vec3 = sweep[0] if sweep else (-80.0, altitude, -80.0)
        ground_starts: List[List[float]] = [
            [-50.0, 0.35, 0.0],
            [0.0, 0.35, -50.0],
            [48.0, 0.35, 36.0],
        ]
        rover_meta = [
            {"id": "RoverHeavy1", "capacity": "heavy"},
            {"id": "RoverLight2", "capacity": "light"},
            {"id": "RoverLight3", "capacity": "light"},
        ]
        world: Dict[str, Any] = {
            "schema": "endendend.blind_handoff.v1",
            "bounds": list(self.bounds),
            "elevation": self.terrain_sample_grid(seed),
            "victims": victims,
            "aerial_start": list(aerial_start),
            "ground_starts": ground_starts,
            "rover_meta": rover_meta,
            "sweep_path": [[round(p[0], 2), round(p[1], 2), round(p[2], 2)] for p in sweep],
            "aerial_speed_m_s": 8.0,
            "ground_speed_m_s": 2.5,
            "timeline": handoff_protocol.timeline_defaults(),
            "seed": seed,
        }
        return world

    def to_json(self, seed: int = 42) -> str:
        return json.dumps(self.generate(seed), indent=2)
