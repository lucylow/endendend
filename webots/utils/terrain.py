"""VRML snippets for floors, tunnel walls, and obstacle solids."""

from __future__ import annotations

import textwrap
from typing import List

from webots.utils.geometry import Rect, Vec2


def floor_plane(size_x: float, size_z: float, y: float = 0.0, name: str = "floor") -> str:
    return textwrap.dedent(
        f"""\
        Solid {{
          translation 0 {y} 0
          children [
            Shape {{
              appearance Appearance {{
                material Material {{ diffuseColor 0.22 0.22 0.26 }}
              }}
              geometry Plane {{ size {size_x} {size_z} }}
            }}
          ]
          name "{name}"
        }}
        """
    )


def obstacle_box(
    center: Vec2,
    size_x: float,
    height: float,
    size_z: float,
    name: str,
    color: tuple[float, float, float] = (0.35, 0.2, 0.15),
) -> str:
    r, g, b = color
    return textwrap.dedent(
        f"""\
        Solid {{
          translation {center.x} {height / 2} {center.z}
          children [
            Shape {{
              appearance Appearance {{
                material Material {{ diffuseColor {r} {g} {b} }}
              }}
              geometry Box {{ size {size_x} {height} {size_z} }}
            }}
          ]
          name "{name}"
          boundingObject Box {{ size {size_x} {height} {size_z} }}
        }}
        """
    )


def tunnel_shell(length: float, width: float, height: float) -> List[str]:
    """Transparent tunnel volume + darker floor strip for blackout look."""
    half_w = width / 2
    h2 = height / 2
    parts = [
        textwrap.dedent(
            f"""\
        Solid {{
          translation {half_w + 0.05} {h2} {length / 2}
          children [
            Shape {{
              appearance Appearance {{
                material Material {{ diffuseColor 0.15 0.15 0.18, transparency 0.82 }}
              }}
              geometry Box {{ size 0.1 {height} {length} }}
            }}
          ]
          name "tunnel_wall_right"
        }}
        """
        ),
        textwrap.dedent(
            f"""\
        Solid {{
          translation {-half_w - 0.05} {h2} {length / 2}
          children [
            Shape {{
              appearance Appearance {{
                material Material {{ diffuseColor 0.15 0.15 0.18, transparency 0.82 }}
              }}
              geometry Box {{ size 0.1 {height} {length} }}
            }}
          ]
          name "tunnel_wall_left"
        }}
        """
        ),
    ]
    return parts


def sector_overlay(rect: Rect, y: float, color: tuple[float, float, float], name: str) -> str:
    """Thin translucent slab marking a sector on the floor."""
    cx, cz = rect.center().x, rect.center().z
    r, g, b = color
    return textwrap.dedent(
        f"""\
        Solid {{
          translation {cx} {y} {cz}
          children [
            Shape {{
              appearance Appearance {{
                material Material {{ diffuseColor {r} {g} {b}, transparency 0.88 }}
              }}
              geometry Box {{ size {rect.width} 0.02 {rect.depth} }}
            }}
          ]
          name "{name}"
        }}
        """
    )


def collapsed_cell_marker(rect: Rect, y: float, name: str) -> str:
    cx, cz = rect.center().x, rect.center().z
    return textwrap.dedent(
        f"""\
        Solid {{
          translation {cx} {y + 0.25} {cz}
          children [
            Shape {{
              appearance Appearance {{
                material Material {{ diffuseColor 0.45 0.1 0.1 }}
              }}
              geometry Box {{ size {min(rect.width, 2.0)} 0.5 {min(rect.depth, 2.0)} }}
            }}
          ]
          name "{name}"
        }}
        """
    )
