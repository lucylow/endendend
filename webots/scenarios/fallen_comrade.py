"""100×100 m arena, five stripe sectors, procedural obstacles, RoverA–E."""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

from webots.scenarios.base import BaseScenario, WorldArtifacts, WorldContext
from webots.scenarios import world_emitter as we
from webots.utils.geometry import Rect, grid_partition, split_stripes_along_x
from webots.utils.spawn import rover_spawns_stripes
from webots.utils import terrain


SECTOR_COLORS: List[Tuple[float, float, float]] = [
    (0.85, 0.25, 0.2),
    (0.25, 0.55, 0.85),
    (0.35, 0.75, 0.35),
    (0.85, 0.65, 0.2),
    (0.65, 0.35, 0.85),
]


class FallenComradeScenario(BaseScenario):
    name = "fallen_comrade"

    def generate(self, seed: int) -> WorldContext:
        rng = random.Random(seed)
        size_x, size_z = 100.0, 100.0
        half_x, half_z = size_x / 2, size_z / 2
        arena = Rect(-half_x, half_x, -half_z, half_z)
        stripes = split_stripes_along_x(arena, 5)
        names = ["RoverA", "RoverB", "RoverC", "RoverD", "RoverE"]
        spawns = rover_spawns_stripes(arena, names)
        free_cells, blocked = grid_partition(arena, 20, 20, rng, block_fraction=0.12)

        parts: List[str] = [
            "#VRML_SIM R2024a utf8",
            "",
            we.externproto_background_floor(),
            we.externproto_swarm_robot("shared/swarm_robot.proto"),
            we.world_header(
                title="Fallen Comrade — 5 sectors / RoverB failure demo",
                info=[
                    "Five ground rovers on a 100×100 m grid with colored sector overlays",
                    f"Deterministic obstacles from seed={seed}; supervisor streams snapshots",
                ],
            ),
            we.standard_viewpoint(55, 42, 55, 0.23, 0.94, 0.25, 4.1),
            we.textured_background(),
            we.rectangle_arena(size_x, size_z, 5.0, 3.0, (0.45, 0.45, 0.48)),
            we.directional_light(),
        ]

        for i, (sec, col) in enumerate(zip(stripes, SECTOR_COLORS)):
            parts.append(terrain.sector_overlay(sec, 0.02, col, f"Sector{chr(ord('A') + i)}"))

        obs_idx = 0
        for cell in blocked[: min(40, len(blocked))]:
            parts.append(
                terrain.collapsed_cell_marker(cell, 0.0, f"Obstacle_{obs_idx:02d}")
            )
            obs_idx += 1

        for s in spawns:
            rid = s.name
            args = ["--scenario", "fallen_comrade", "--id", rid]
            parts.append(
                we.swarm_robot_node(
                    name=rid,
                    x=s.position.x,
                    z=s.position.z,
                    y=0.2,
                    robot_type="ground",
                    controller="rover_controller",
                    controller_args=args,
                )
            )

        parts.append(
            we.supervisor_emitter_robot(
                "scenario_supervisor",
                ["--scenario", "fallen_comrade", "--seed", str(seed)],
            )
        )

        wbt = we.join(parts)

        sectors_meta = [
            {
                "id": f"Sector{chr(ord('A') + i)}",
                "bounds": [stripe.min_x, stripe.max_x, stripe.min_z, stripe.max_z],
                "color": list(SECTOR_COLORS[i]),
            }
            for i, stripe in enumerate(stripes)
        ]
        obstacles_meta = [
            {
                "id": f"Obstacle_{i:02d}",
                "bounds": [b.min_x, b.max_x, b.min_z, b.max_z],
            }
            for i, b in enumerate(blocked[: min(40, len(blocked))])
        ]
        metadata: Dict[str, Any] = {
            "scenario": self.name,
            "world_file": "fallen_comrade.wbt",
            "size": [size_x, size_z],
            "seed": seed,
            "agents": names,
            "victims": [],
            "zones": [s["id"] for s in sectors_meta],
            "failure": {"rover_kill": "RoverB", "sim_time_s": 18.0},
        }
        grid_extra: Dict[str, Any] = {
            "scenario": self.name,
            "seed": seed,
            "sectors": sectors_meta,
            "obstacles": obstacles_meta,
            "coverage_cells_free": len(free_cells),
        }
        artifacts = WorldArtifacts(metadata=metadata, extras={"fallen_comrade_grid.json": grid_extra})
        return WorldContext(
            scenario=self.name,
            seed=seed,
            wbt_text=wbt,
            artifacts=artifacts,
            world_filename="fallen_comrade.wbt",
        )
