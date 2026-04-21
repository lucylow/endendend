"""Flexible open arena for generic swarm / SAR exercises."""

from __future__ import annotations

import random
from typing import Any, Dict, List

from webots.scenarios.base import BaseScenario, WorldArtifacts, WorldContext
from webots.scenarios import world_emitter as we
from webots.utils.geometry import Rect, grid_partition
from webots.utils import terrain


class OpenTrackScenario(BaseScenario):
    name = "open_track"

    def generate(self, seed: int) -> WorldContext:
        rng = random.Random(seed)
        sx, sz = 180.0, 180.0
        half_x, half_z = sx / 2, sz / 2
        arena = Rect(-half_x, half_x, -half_z, half_z)
        _, blocked = grid_partition(arena, 18, 18, rng, block_fraction=0.06)
        agents = ["RoverA", "RoverB", "RoverC", "RoverD"]
        corners = [(-55.0, -55.0), (55.0, -55.0), (-55.0, 55.0), (55.0, 55.0)]

        parts: List[str] = [
            "#VRML_SIM R2024a utf8",
            "",
            we.externproto_background_floor(),
            we.externproto_swarm_robot("shared/swarm_robot.proto"),
            we.world_header(
                title="Open Track — general swarm coordination",
                info=[
                    "Configurable-sized arena with sparse obstacles; supervisor publishes snapshots",
                    f"Seed {seed}",
                ],
            ),
            we.standard_viewpoint(95, 72, 95, 0.25, 0.92, 0.28, 4.1),
            we.textured_background(),
            we.rectangle_arena(sx, sz, 9.0, 3.5, (0.42, 0.44, 0.48)),
            we.directional_light(),
        ]

        for i, cell in enumerate(blocked[:24]):
            parts.append(terrain.collapsed_cell_marker(cell, 0.0, f"OpenObstacle_{i:02d}"))

        for rid, (gx, gz) in zip(agents, corners):
            parts.append(
                we.swarm_robot_node(
                    name=rid,
                    x=gx,
                    z=gz,
                    y=0.2,
                    robot_type="ground",
                    controller="rover_controller",
                    controller_args=["--scenario", "open_track", "--id", rid],
                )
            )

        parts.append(
            we.supervisor_emitter_robot(
                "scenario_supervisor",
                ["--scenario", "open_track", "--seed", str(seed)],
            )
        )

        wbt = we.join(parts)
        metadata: Dict[str, Any] = {
            "scenario": self.name,
            "world_file": "open_track.wbt",
            "size": [sx, sz],
            "seed": seed,
            "agents": agents,
            "victims": [],
            "zones": ["MissionArea"],
        }
        artifacts = WorldArtifacts(metadata=metadata, extras={})
        return WorldContext(
            scenario=self.name,
            seed=seed,
            wbt_text=wbt,
            artifacts=artifacts,
            world_filename="open_track.wbt",
        )
