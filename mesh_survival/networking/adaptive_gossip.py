"""Geometric priority gossip: urgency × geometry × staleness, top-K neighbor fan-out."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Mapping, Optional, Sequence, Tuple


class MessageUrgency(Enum):
    """Relative priority bands (higher value = more critical)."""

    MAP_SHARE = 0.15
    ODOMETRY = 0.12
    STATE_UPDATE = 0.35
    HEARTBEAT = 0.4
    ROLE_REQUEST = 0.75
    VICTIM_FOUND = 0.95
    SAFETY_STOP = 1.0


@dataclass(frozen=True)
class Vector3:
    x: float
    y: float
    z: float

    def dist_to(self, other: "Vector3") -> float:
        dx = self.x - other.x
        dy = self.y - other.y
        dz = self.z - other.z
        return math.sqrt(dx * dx + dy * dy + dz * dz)


@dataclass
class GossipMessage:
    """Wire-friendly envelope; callers map dict payloads into this shape."""

    urgency: MessageUrgency
    created_mono: float
    msg_id: str
    signed_duplicate_key: str
    payload: Dict[str, object]


def staleness_factor(msg: GossipMessage, *, now_mono: Optional[float] = None) -> float:
    """Boost priority for older critical hints so they keep getting chances under loss."""
    t = time.monotonic() if now_mono is None else float(now_mono)
    age = max(0.0, t - msg.created_mono)
    # Cap so MAP_SHARE does not dominate forever.
    return 1.0 + min(2.5, age * 2.0)


def gossip_priority(
    msg: GossipMessage,
    sender_pos: Vector3,
    target_pos: Vector3,
    *,
    now_mono: Optional[float] = None,
) -> float:
    """Priority = urgency × geometric bonus × staleness (mega-prompt formula, extended)."""
    base = float(msg.urgency.value)
    dist = sender_pos.dist_to(target_pos)
    geo_bonus = 1.0 / (dist + 0.1)
    stale_bonus = staleness_factor(msg, now_mono=now_mono)
    return base * geo_bonus * stale_bonus


def adaptive_fanout_k(packet_loss: float, *, k_min: int = 3, k_max: int = 8) -> int:
    """Raise fan-out as observed loss increases (3→8)."""
    p = min(0.999, max(0.0, float(packet_loss)))
    span = k_max - k_min
    ratio = min(1.0, p / 0.9)
    return int(min(k_max, max(k_min, round(k_min + span * ratio))))


def rank_neighbors_for_delivery(
    msg: GossipMessage,
    self_pos: Vector3,
    target_pos: Vector3,
    neighbor_positions: Mapping[str, Vector3],
    *,
    now_mono: Optional[float] = None,
) -> List[Tuple[str, float]]:
    """Return (node_id, priority) sorted descending for geometric priority flooding."""
    ranked: List[Tuple[str, float]] = []
    for nid, pos in neighbor_positions.items():
        ghost = GossipMessage(
            urgency=msg.urgency,
            created_mono=msg.created_mono,
            msg_id=msg.msg_id,
            signed_duplicate_key=msg.signed_duplicate_key,
            payload=msg.payload,
        )
        pr = gossip_priority(ghost, pos, target_pos, now_mono=now_mono)
        ranked.append((nid, pr))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked


def top_k_neighbors(
    ranked: Sequence[Tuple[str, float]],
    k_base: int,
    *,
    loss: float,
) -> List[str]:
    """Pick up to K neighbors; fan-out rises with loss (at least k_base)."""
    kk = min(len(ranked), max(int(k_base), adaptive_fanout_k(loss)))
    return [n for n, _ in ranked[:kk]]


def ttl_decay(initial_ttl: int, hop: int) -> int:
    """Exponential-style TTL decay per hop (floors at 1)."""
    if initial_ttl <= 1:
        return max(1, initial_ttl)
    return max(1, int(initial_ttl * math.exp(-0.35 * hop)))
