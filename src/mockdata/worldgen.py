"""Procedural 100x100m world (1m cells) with sectors and victims."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List

from mockdata import sectorizer
from mockdata import terrain
from mockdata import victim_spawner

Cell = int


class WorldGenerator:
    def __init__(self, seed: int = 42) -> None:
        self.seed = seed

    def generate(self) -> Dict[str, Any]:
        rng = random.Random(self.seed)
        grid: List[List[Cell]] = [[0 for _ in range(100)] for _ in range(100)]
        obstacles = terrain.place_tunnel_collapse(grid, rng)
        sectors = {k: list(v) for k, v in sectorizer.initial_sectors_100().items()}
        victims = victim_spawner.spawn_victims(grid, rng)
        return {
            "grid": grid,
            "sectors": sectors,
            "victims": victims,
            "obstacles": obstacles,
            "seed": self.seed,
        }

    def write_json(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.generate(), indent=2), encoding="utf-8")
