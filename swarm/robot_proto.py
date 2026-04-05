"""Webots .proto file generator for SwarmRobot and world file scaffolding.

This module generates the VRML .proto and .wbt content programmatically,
so teams can quickly produce worlds with N robots at specified positions.

Usage (CLI):
    python -m swarm.robot_proto --robots 8 --world tunnel > worlds/tunnel.wbt
    python -m swarm.robot_proto --proto > protos/SwarmRobot.proto
"""

from __future__ import annotations

import argparse
import math
import textwrap
from typing import List, Tuple

# ---------------------------------------------------------------------------
# Proto template
# ---------------------------------------------------------------------------
SWARM_ROBOT_PROTO = textwrap.dedent("""\
#VRML_SIM R2025a utf8
# SwarmRobot — lightweight drone/rover for coordination demos.
# Minimal physics, GPS + LED for role visualisation.
PROTO SwarmRobot [
  field SFVec3f    translation   0 0 0
  field SFRotation rotation      0 0 1 0
  field SFString   name          "robot"
  field SFString   controller    "swarm_controller"
  field SFString   controllerArgs ""
  field SFString   type          "aerial"
]
{
  Robot {
    translation IS translation
    rotation IS rotation
    name IS name
    controller IS controller
    controllerArgs IS controllerArgs
    children [
      # Body — simple box keeps rendering fast
      DEF body Shape {
        appearance Appearance {
          material Material { diffuseColor 0.35 0.35 0.4 }
        }
        geometry Box { size 0.4 0.15 0.4 }
      }
      # Role LED
      LED {
        name "led"
        color 1 0 0
      }
      # GPS
      GPS { name "gps" }
      # Distance sensor — victim proximity
      DistanceSensor {
        name "distance_sensor"
        translation 0 0.15 0
        lookupTable [ 0 0 0, 0.5 500 0 ]
        numberOfRays 1
        aperture 0.8
      }
      # Debug display (optional)
      Display {
        name "debug_display"
        width 128
        height 64
      }
    ]
    boundingObject USE body
    physics NULL
  }
}
""")


# ---------------------------------------------------------------------------
# World templates
# ---------------------------------------------------------------------------

def _world_header(timestep: int = 32) -> str:
    return textwrap.dedent(f"""\
    #VRML_SIM R2025a utf8
    WorldInfo {{
      basicTimeStep {timestep}
      title "Swarm Coordination Demo"
    }}
    Viewpoint {{
      orientation -0.3 0.9 0.3 1.2
      position 0 80 120
    }}
    Background {{
      skyColor [ 0.15 0.15 0.2 ]
    }}
    DirectionalLight {{
      direction -0.4 -1 -0.5
      intensity 0.8
    }}
    """)


def _floor(size: float = 200.0) -> str:
    return textwrap.dedent(f"""\
    Solid {{
      children [
        Shape {{
          appearance Appearance {{
            material Material {{ diffuseColor 0.25 0.25 0.28 }}
          }}
          geometry Plane {{ size {size} {size} }}
        }}
      ]
      name "floor"
    }}
    """)


def _tunnel_walls(length: float = 100.0, width: float = 10.0, height: float = 5.0) -> str:
    return textwrap.dedent(f"""\
    # Tunnel walls (transparent for visibility)
    Solid {{
      translation 0 {height / 2} {length / 2}
      children [
        Shape {{
          appearance Appearance {{
            material Material {{ diffuseColor 0.5 0.5 0.55, transparency 0.75 }}
          }}
          geometry Box {{ size {width} {height} {length} }}
        }}
      ]
      name "tunnel"
    }}
    """)


def _victim(name: str, x: float, y: float, z: float) -> str:
    return textwrap.dedent(f"""\
    Solid {{
      translation {x} 0.15 {z}
      children [
        Shape {{
          appearance Appearance {{
            material Material {{ diffuseColor 0.9 0.15 0.15 }}
          }}
          geometry Sphere {{ radius 0.25 }}
        }}
      ]
      name "{name}"
    }}
    """)


def _robot_node(
    node_id: str,
    x: float,
    z: float,
    robot_type: str = "aerial",
) -> str:
    args = f"--id {node_id} --type {robot_type}"
    return textwrap.dedent(f"""\
    SwarmRobot {{
      translation {x} 0.2 {z}
      name "{node_id}"
      type "{robot_type}"
      controllerArgs "{args}"
    }}
    """)


# ---------------------------------------------------------------------------
# Public generators
# ---------------------------------------------------------------------------

def generate_proto() -> str:
    """Return the VRML proto text."""
    return SWARM_ROBOT_PROTO


def generate_tunnel_world(
    num_robots: int = 5,
    tunnel_length: float = 100.0,
    victim_depths: Tuple[float, ...] = (20.0, 40.0, 60.0, 80.0),
) -> str:
    """Generate a tunnel .wbt with robots at the entrance and victims inside."""
    parts = [_world_header(), _floor(tunnel_length * 2), _tunnel_walls(tunnel_length)]
    for i, depth in enumerate(victim_depths):
        parts.append(_victim(f"victim_{i + 1}", 0.0, 0.0, depth))
    spacing = 2.0
    start_x = -(num_robots - 1) * spacing / 2
    for i in range(num_robots):
        parts.append(_robot_node(f"drone_{i + 1}", start_x + i * spacing, 0.0))
    return "\n".join(parts)


def generate_open_field_world(
    num_robots: int = 6,
    field_size: float = 100.0,
) -> str:
    """Generate an open-field .wbt for fallen-comrade and sector reallocation."""
    parts = [_world_header(), _floor(field_size)]
    # Place victims in a scattered pattern
    import random
    rng = random.Random(42)
    for i in range(4):
        parts.append(_victim(f"victim_{i + 1}", rng.uniform(-30, 30), 0.0, rng.uniform(10, 80)))
    # Rovers in a grid
    cols = int(math.ceil(math.sqrt(num_robots)))
    gap = field_size / (cols + 1)
    for i in range(num_robots):
        r, c = divmod(i, cols)
        x = -field_size / 2 + (c + 1) * gap
        z = (r + 1) * gap
        parts.append(_robot_node(f"rover_{i + 1}", x, z, "ground"))
    return "\n".join(parts)


def generate_air_ground_world(
    num_aerial: int = 2,
    num_ground: int = 4,
) -> str:
    """Generate an air-ground .wbt for blind-handoff demos."""
    parts = [_world_header(), _floor(150.0)]
    parts.append(_victim("victim_1", 20.0, 0.0, 50.0))
    parts.append(_victim("victim_2", -15.0, 0.0, 70.0))
    for i in range(num_aerial):
        parts.append(_robot_node(f"aerial_{i + 1}", -10 + i * 5, 0.0, "aerial"))
    for i in range(num_ground):
        parts.append(_robot_node(f"ground_{i + 1}", -10 + i * 5, 20.0, "ground"))
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Webots proto / world files")
    parser.add_argument("--proto", action="store_true", help="Output SwarmRobot.proto")
    parser.add_argument("--world", choices=["tunnel", "open_field", "air_ground"], default=None)
    parser.add_argument("--robots", type=int, default=5)
    args = parser.parse_args()

    if args.proto:
        print(generate_proto())
    elif args.world == "tunnel":
        print(generate_tunnel_world(args.robots))
    elif args.world == "open_field":
        print(generate_open_field_world(args.robots))
    elif args.world == "air_ground":
        print(generate_air_ground_world())
    else:
        print(generate_proto())
