"""Consensus channel names → FoxMQ topic suffixes (swarm-scoped)."""

from __future__ import annotations

from enum import Enum


class Channel(str, Enum):
    ROLES = "state/roles"
    CHAIN = "state/chain"
    HEARTBEAT = "state/heartbeat"
    POSE_GRAPH = "state/pose_graph"
    VICTIM = "events/victim_found"


def state_topic(ch: Channel | str) -> str:
    rel = ch.value if isinstance(ch, Channel) else str(ch).lstrip("/")
    return f"vertex/{rel}"
