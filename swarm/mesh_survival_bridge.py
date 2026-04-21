"""Optional bridge: map wire dicts → ``mesh_survival`` geometric fan-out targets."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Mapping, Optional, Tuple

from mesh_survival.networking.adaptive_gossip import (
    GossipMessage,
    MessageUrgency,
    Vector3,
    rank_neighbors_for_delivery,
    top_k_neighbors,
)

_URGENCY_BY_TYPE: Dict[str, MessageUrgency] = {
    "SAFETY_STOP": MessageUrgency.SAFETY_STOP,
    "VICTIM_FOUND": MessageUrgency.VICTIM_FOUND,
    "ROLE_REQUEST": MessageUrgency.ROLE_REQUEST,
    "HEARTBEAT": MessageUrgency.HEARTBEAT,
    "STATE_UPDATE": MessageUrgency.STATE_UPDATE,
    "MAP_SHARE": MessageUrgency.MAP_SHARE,
    "ODOMETRY": MessageUrgency.ODOMETRY,
}


def _vec(d: Mapping[str, Any]) -> Vector3:
    return Vector3(float(d.get("x", 0.0)), float(d.get("y", 0.0)), float(d.get("z", 0.0)))


def urgency_for_message(msg: Mapping[str, Any]) -> MessageUrgency:
    mt = str(msg.get("type", "")).upper()
    return _URGENCY_BY_TYPE.get(mt, MessageUrgency.STATE_UPDATE)


def geometric_fanout_targets(
    msg: Mapping[str, Any],
    self_pos: Mapping[str, float],
    target_pos: Mapping[str, float],
    neighbor_positions: Mapping[str, Mapping[str, float]],
    *,
    k_base: int = 3,
    loss: float = 0.0,
    now_mono: Optional[float] = None,
) -> List[str]:
    """Return ordered neighbor ids for priority unicast (K adapts with ``loss``)."""
    tmono = time.monotonic() if now_mono is None else float(now_mono)
    gm = GossipMessage(
        urgency=urgency_for_message(msg),
        created_mono=tmono,
        msg_id=str(msg.get("msg_id", "")) or str(msg.get("flood_id", "local")),
        signed_duplicate_key=str(msg.get("sig", msg.get("msg_id", "anon"))),
        payload=dict(msg),
    )
    ranked = rank_neighbors_for_delivery(
        gm,
        _vec(self_pos),
        _vec(target_pos),
        {k: _vec(v) for k, v in neighbor_positions.items()},
        now_mono=tmono,
    )
    return top_k_neighbors(ranked, int(k_base), loss=float(loss))
