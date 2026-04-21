"""Assemble Webots R2024a world text from parts (EXTERNPROTO + nodes)."""

from __future__ import annotations

import textwrap
from typing import Iterable, List, Sequence


R2024A_BASE = "https://raw.githubusercontent.com/cyberbotics/webots/R2024a/projects/objects"


def externproto_background_floor() -> str:
    return textwrap.dedent(f"""\
    EXTERNPROTO "{R2024A_BASE}/backgrounds/protos/TexturedBackground.proto"
    EXTERNPROTO "{R2024A_BASE}/floors/protos/RectangleArena.proto"
    """)


def externproto_swarm_robot(relative_proto: str) -> str:
    return f'EXTERNPROTO "{relative_proto}"\n'


def world_header(*, title: str, info: Sequence[str], timestep: int = 32) -> str:
    lines = ",\n    ".join(f'"{s}"' for s in info)
    return textwrap.dedent(
        f"""\
    WorldInfo {{
      title "{title}"
      info [
        {lines}
      ]
      gravity 0 -9.81 0
      physics "ODE"
      basicTimeStep {timestep}
      FPS 60
    }}
    """
    )


def standard_viewpoint(x: float, y: float, z: float, ox: float, oy: float, oz: float, a: float) -> str:
    return textwrap.dedent(
        f"""\
    Viewpoint {{
      position {x} {y} {z}
      orientation {ox} {oy} {oz} {a}
    }}
    """
    )


def textured_background(texture: str = "noon_cloudy_countryside") -> str:
    return textwrap.dedent(
        f"""\
    TexturedBackground {{
      texture "{texture}"
    }}
    """
    )


def rectangle_arena(
    floor_x: float,
    floor_z: float,
    tile: float,
    wall_h: float,
    wall_rgb: tuple[float, float, float],
) -> str:
    r, g, b = wall_rgb
    return textwrap.dedent(
        f"""\
    RectangleArena {{
      floorSize {floor_x} {floor_z}
      floorTileSize {tile}
      wallHeight {wall_h}
      wallThickness 0.15
      wallColor {r} {g} {b}
    }}
    """
    )


def directional_light() -> str:
    return textwrap.dedent(
        """\
    DirectionalLight {
      direction 0.4 -1 0.3
      intensity 1.2
      castShadows TRUE
    }
    """
    )


def swarm_robot_node(
    *,
    name: str,
    x: float,
    z: float,
    y: float,
    robot_type: str,
    controller: str,
    controller_args: Sequence[str],
) -> str:
    args_lines = "\n      ".join(f'"{a}"' for a in controller_args)
    return textwrap.dedent(
        f"""\
    DEF {name} SwarmRobot {{
      translation {x} {y} {z}
      name "{name}"
      type "{robot_type}"
      controller "{controller}"
      controllerArgs [
      {args_lines}
      ]
    }}
    """
    )


def supervisor_emitter_robot(controller: str, args: Sequence[str]) -> str:
    args_lines = "\n      ".join(f'"{a}"' for a in args)
    return textwrap.dedent(
        f"""\
    Robot {{
      translation 0 0.12 0
      name "scenario_emitter"
      controller "{controller}"
      controllerArgs [
      {args_lines}
      ]
      supervisor TRUE
      children []
    }}
    """
    )


def join(parts: Iterable[str]) -> str:
    return "\n".join(p.strip() for p in parts if p.strip()) + "\n"


def dark_background_sky() -> str:
    return textwrap.dedent(
        """\
    Background {
      skyColor [ 0.02 0.02 0.04 ]
    }
    """
    )
