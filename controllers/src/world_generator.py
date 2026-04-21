"""Emit Webots VRML fragments for procedural tunnel + surface victims."""

from __future__ import annotations

from typing import List

from tunnel_geometry import TunnelGeometry, build_tunnel_geometry


def tunnel_segment_solids(geom: TunnelGeometry, step_m: float = 12.0) -> str:
    """Axis-aligned tunnel shell segments along +Z (depth)."""
    lines: List[str] = []
    z = 0.0
    idx = 0
    while z < geom.length_m - 0.5:
        seg_len = min(step_m, geom.length_m - z)
        cx = 0.0
        cy = 2.5
        cz = z + seg_len * 0.5
        w, h = geom.width_m + 1.2, geom.height_m + 0.6
        shade = 0.22 + 0.18 * min(1.0, z / max(geom.length_m, 1.0))
        lines.append(
            f"""Solid {{
  translation {cx:.2f} {cy:.2f} {cz:.2f}
  name "tunnel_seg_{idx}"
  children [
    Shape {{
      appearance PBRAppearance {{
        baseColor {shade:.3f} {shade:.3f} {shade + 0.04:.3f}
        roughness 0.92
        metalness 0.02
      }}
      geometry Box {{
        size {w:.2f} {h:.2f} {seg_len:.2f}
      }}
    }}
  ]
  boundingObject NULL
  physics NULL
}}
"""
        )
        z += seg_len
        idx += 1
    return "\n".join(lines)


def victim_markers(depths: List[float]) -> str:
    out: List[str] = []
    for i, s in enumerate(depths):
        x = 2.5 if i % 2 == 0 else -2.5
        out.append(
            f"""Solid {{
  translation {x:.2f} 0.35 {s:.2f}
  name "victim_marker_{i}"
  children [
    Shape {{
      appearance PBRAppearance {{
        baseColor 0.95 0.35 0.15
        emissiveColor 0.4 0.1 0.02
      }}
      geometry Sphere {{ radius 0.45 }}
    }}
  ]
  physics NULL
}}
"""
        )
    return "\n".join(out)


def build_world_body(seed: int = 42) -> str:
    geom = build_tunnel_geometry(seed)
    depths = [z for z0, z1, _ in geom.target_zones for z in [(z0 + z1) * 0.5]]
    return tunnel_segment_solids(geom) + "\n" + victim_markers(depths)
