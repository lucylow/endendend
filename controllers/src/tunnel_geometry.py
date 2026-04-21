"""Procedural tunnel geometry (200 m axis) aligned with Track 2 Dynamic Daisy Chain."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List
import random


@dataclass
class TunnelSegment:
    id: str
    start_s: float
    end_s: float
    label: str
    attenuation_mul: float
    blocked: bool = False


@dataclass
class TunnelGeometry:
    length_m: float = 200.0
    width_m: float = 10.0
    height_m: float = 5.0
    entrance_s: float = 0.0
    segments: List[TunnelSegment] = field(default_factory=list)
    collapse_points: List[float] = field(default_factory=list)
    relay_anchor_zones: List[tuple[float, float, str]] = field(default_factory=list)
    signal_shadow_zones: List[tuple[float, float, float]] = field(default_factory=list)
    target_zones: List[tuple[float, float, str]] = field(default_factory=list)


def _jitter(rng: random.Random, base: float, spread: float) -> float:
    return base + (rng.random() - 0.5) * 2 * spread


def build_tunnel_geometry(seed: int = 42) -> TunnelGeometry:
    rng = random.Random(seed ^ 0x9E3779B9)
    length_m = _jitter(rng, 200.0, 8.0)
    width_m = 9.0 + rng.random() * 1.2
    segments: List[TunnelSegment] = []
    chunk = length_m / 5.5
    cursor = 0.0
    labels = ["ingress", "dust_mid", "choke", "deep_shaft", "terminal"]
    for i, lab in enumerate(labels):
        if cursor >= length_m - 0.5:
            break
        span = chunk * (0.85 + rng.random() * 0.35)
        end = min(length_m, cursor + span)
        segments.append(
            TunnelSegment(
                id=f"seg_{i}",
                start_s=cursor,
                end_s=end,
                label=lab,
                attenuation_mul=1.0 + rng.random() * 0.35 + (0.25 if i >= 2 else 0),
                blocked=i == 3 and rng.random() > 0.65,
            )
        )
        cursor = end
    if segments and segments[-1].end_s < length_m:
        last = segments[-1]
        segments.append(
            TunnelSegment(
                id="terminal_pad",
                start_s=last.end_s,
                end_s=length_m,
                label="terminal",
                attenuation_mul=1.08 + rng.random() * 0.12,
                blocked=False,
            )
        )
    collapse_points = [length_m * (0.22 + i * 0.21) + (rng.random() - 0.5) * 6 for i in range(4)]
    relay_anchor_zones = []
    for z in range(4):
        c = length_m * (0.15 + z * 0.22) + (rng.random() - 0.5) * 8
        relay_anchor_zones.append((max(0.0, c - 5), min(length_m, c + 5), f"anchor_{z}"))
    signal_shadow_zones = []
    for s in range(3):
        c = length_m * (0.28 + s * 0.24)
        signal_shadow_zones.append((c - 10, c + 10, 0.06 + rng.random() * 0.12))
    target_zones = [
        (length_m * 0.62, length_m * 0.7, "victim_cluster_a"),
        (length_m * 0.78, length_m * 0.9, "victim_cluster_b"),
    ]
    return TunnelGeometry(
        length_m=length_m,
        width_m=width_m,
        height_m=5.0,
        entrance_s=0.0,
        segments=segments,
        collapse_points=collapse_points,
        relay_anchor_zones=relay_anchor_zones,
        signal_shadow_zones=signal_shadow_zones,
        target_zones=target_zones,
    )


def segment_loss_mul(geom: TunnelGeometry, s: float) -> float:
    m = 1.0
    for seg in geom.segments:
        if seg.start_s <= s <= seg.end_s:
            m *= seg.attenuation_mul
            if seg.blocked:
                m *= 1.28
    for z0, z1, loss_add in geom.signal_shadow_zones:
        if z0 <= s <= z1:
            m *= 1.0 + loss_add
    return m
