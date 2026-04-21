"""200×200 m field: Aerial1 + three ground rovers, victim zone, sweep corridor."""

from __future__ import annotations

import random
from typing import Any, Dict, List

from webots.scenarios.base import BaseScenario, WorldArtifacts, WorldContext
from webots.scenarios import world_emitter as we
from webots.utils.geometry import Rect, Vec2
from webots.utils.spawn import Spawn, victim_in_zone
from webots.utils import terrain


class BlindHandoffScenario(BaseScenario):
    name = "blind_handoff"

    def generate(self, seed: int) -> WorldContext:
        rng = random.Random(seed)
        sx, sz = 200.0, 200.0
        half_x, half_z = sx / 2, sz / 2
        arena = Rect(-half_x, half_x, -half_z, half_z)
        victim_zone = Rect(-20, 20, 10, 50)
        vic = victim_in_zone(victim_zone, rng, "Victim01")

        parts: List[str] = [
            "#VRML_SIM R2024a utf8",
            "",
            we.externproto_background_floor(),
            we.externproto_swarm_robot("shared/swarm_robot.proto"),
            'EXTERNPROTO "shared/victim_marker.proto"\n',
            we.world_header(
                title="Blind Handoff — aerial sweep + ground rescue",
                info=[
                    "Aerial1 + RoverA/B/C on a 200×200 m field; victim + auction via supervisor",
                    f"Seed {seed}: victim placement deterministic inside victim zone",
                ],
            ),
            we.standard_viewpoint(120, 90, 120, 0.28, 0.92, 0.28, 4.2),
            we.textured_background(),
            we.rectangle_arena(sx, sz, 10.0, 5.0, (0.5, 0.5, 0.52)),
            we.directional_light(),
        ]

        vz = victim_zone
        parts.append(
            terrain.sector_overlay(
                Rect(vz.min_x - 2, vz.max_x + 2, vz.min_z - 2, vz.max_z + 2),
                0.03,
                (0.9, 0.85, 0.2),
                "VictimZone",
            )
        )
        parts.append(
            terrain.sector_overlay(Rect(-half_x + 5, -half_x + 25, -30, 30), 0.025, (0.2, 0.85, 0.9), "SweepLane")
        )
        parts.append(
            terrain.sector_overlay(Rect(30, 70, -half_z + 10, -half_z + 40), 0.025, (0.3, 0.9, 0.4), "RescueZone")
        )

        parts.append(
            f"""DEF Victim01 VictimMarker {{
  translation {vic.position.x} 0.2 {vic.position.z}
  name "Victim01"
}}
"""
        )

        aerial = Spawn("Aerial1", position=Vec2(-75.0, -75.0))
        parts.append(
            we.swarm_robot_node(
                name=aerial.name,
                x=aerial.position.x,
                z=aerial.position.z,
                y=6.0,
                robot_type="aerial",
                controller="aerial_controller",
                controller_args=["--scenario", "blind_handoff", "--id", "Aerial1"],
            )
        )

        ground_positions = [(-60.0, -50.0), (-40.0, -55.0), (-50.0, -35.0)]
        for i, (gx, gz) in enumerate(ground_positions, start=1):
            rid = f"Rover{chr(ord('A') + i - 1)}"
            parts.append(
                we.swarm_robot_node(
                    name=rid,
                    x=gx,
                    z=gz,
                    y=0.2,
                    robot_type="ground",
                    controller="rover_controller",
                    controller_args=["--scenario", "blind_handoff", "--id", rid],
                )
            )

        parts.append(
            we.supervisor_emitter_robot(
                "scenario_supervisor",
                ["--scenario", "blind_handoff", "--seed", str(seed)],
            )
        )

        wbt = we.join(parts)
        metadata: Dict[str, Any] = {
            "scenario": self.name,
            "world_file": "blind_handoff.wbt",
            "size": [sx, sz],
            "seed": seed,
            "agents": ["Aerial1", "RoverA", "RoverB", "RoverC"],
            "victims": ["Victim01"],
            "zones": ["VictimZone", "SweepLane", "RescueZone"],
            "auction": {"battery_threshold": 0.25},
        }
        victims_extra = {
            "victims": [
                {
                    "id": "Victim01",
                    "position": [vic.position.x, vic.position.z],
                    "zone": [victim_zone.min_x, victim_zone.max_x, victim_zone.min_z, victim_zone.max_z],
                }
            ]
        }
        artifacts = WorldArtifacts(metadata=metadata, extras={"blind_handoff_victims.json": victims_extra})
        return WorldContext(
            scenario=self.name,
            seed=seed,
            wbt_text=wbt,
            artifacts=artifacts,
            world_filename="blind_handoff.wbt",
        )
