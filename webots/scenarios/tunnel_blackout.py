"""Narrow corridor relay geometry with blackout styling."""

from __future__ import annotations

from typing import Any, Dict, List

from webots.scenarios.base import BaseScenario, WorldArtifacts, WorldContext
from webots.scenarios import world_emitter as we
from webots.utils.geometry import Rect
from webots.utils import terrain


class TunnelBlackoutScenario(BaseScenario):
    name = "tunnel_blackout"

    def generate(self, seed: int) -> WorldContext:
        length, width = 120.0, 10.0
        parts: List[str] = [
            "#VRML_SIM R2024a utf8",
            "",
            we.externproto_background_floor(),
            we.externproto_swarm_robot("shared/swarm_robot.proto"),
            we.world_header(
                title="Tunnel / Blackout — relay chain under degraded comms",
                info=[
                    "Long narrow corridor; relay roles + packet-loss events via supervisor",
                    f"Seed {seed}",
                ],
            ),
            we.standard_viewpoint(18, 14, 55, 0.12, 0.94, 0.32, 4.4),
            we.dark_background_sky(),
            we.rectangle_arena(width + 6, length + 6, 2.0, 4.0, (0.12, 0.12, 0.14)),
            """DirectionalLight {
  direction 0.2 -1 0.25
  intensity 0.45
  castShadows TRUE
}
""",
            """PointLight {
  location 0 3 0
  intensity 0.35
  radius 28
}
""",
        ]
        parts.extend(terrain.tunnel_shell(length=length, width=width, height=4.5))

        relay_zs = [-45.0, -15.0, 15.0, 45.0]
        names = ["RoverA", "RoverB", "RoverC", "RoverD"]
        for rid, rz in zip(names, relay_zs):
            parts.append(
                we.swarm_robot_node(
                    name=rid,
                    x=0.0,
                    z=rz,
                    y=0.2,
                    robot_type="ground",
                    controller="rover_controller",
                    controller_args=["--scenario", "tunnel_blackout", "--id", rid],
                )
            )
            parts.append(
                terrain.sector_overlay(
                    Rect(-2.0, 2.0, rz - 6, rz + 6),
                    0.02,
                    (0.25, 0.55, 0.95),
                    f"RelayZone_{rid}",
                )
            )

        parts.append(
            we.supervisor_emitter_robot(
                "scenario_supervisor",
                ["--scenario", "tunnel_blackout", "--seed", str(seed)],
            )
        )

        wbt = we.join(parts)
        metadata: Dict[str, Any] = {
            "scenario": self.name,
            "world_file": "tunnel_blackout.wbt",
            "size": [width + 6, length + 6],
            "seed": seed,
            "agents": names,
            "victims": [],
            "zones": [f"RelayZone_{n}" for n in names],
            "connectivity": {"packet_loss_spike_s": [5.0, 22.0, 40.0]},
        }
        artifacts = WorldArtifacts(metadata=metadata, extras={})
        return WorldContext(
            scenario=self.name,
            seed=seed,
            wbt_text=wbt,
            artifacts=artifacts,
            world_filename="tunnel_blackout.wbt",
        )
