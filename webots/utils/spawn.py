"""Spawn placement: agents, victims, and safe validation."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Sequence

from webots.utils.geometry import Rect, Vec2, clamp_to_rect, distance, split_stripes_along_x


@dataclass(frozen=True)
class Spawn:
    name: str
    position: Vec2
    yaw: float = 0.0


def rover_spawns_stripes(arena: Rect, names: Sequence[str]) -> List[Spawn]:
    sectors = split_stripes_along_x(arena, len(names))
    out: List[Spawn] = []
    for name, sec in zip(names, sectors):
        c = sec.center()
        out.append(Spawn(name=name, position=Vec2(c.x, c.z)))
    return out


def aerial_spawn(corridor_center: Vec2, offset_x: float = 0.0) -> Spawn:
    return Spawn(name="Aerial1", position=Vec2(corridor_center.x + offset_x, corridor_center.z))


def victim_in_zone(zone: Rect, rng: random.Random, name: str = "Victim01") -> Spawn:
    p = Vec2(
        rng.uniform(zone.min_x + 1.0, zone.max_x - 1.0),
        rng.uniform(zone.min_z + 1.0, zone.max_z - 1.0),
    )
    return Spawn(name=name, position=clamp_to_rect(p, zone))


def validate_min_spacing(spawns: Sequence[Spawn], min_dist: float) -> bool:
    pts = [s.position for s in spawns]
    for i, a in enumerate(pts):
        for b in pts[i + 1 :]:
            if distance(a, b) < min_dist:
                return False
    return True


def assign_sectors(names: Sequence[str]) -> Dict[str, str]:
    letters = "ABCDE"
    return {n: f"Sector{letters[i]}" for i, n in enumerate(names) if i < len(letters)}
