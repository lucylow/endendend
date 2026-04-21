"""Track-2 mesh survival primitives: geometric gossip, tiered liveness, role failover."""

from __future__ import annotations

from mesh_survival.failure_recovery.role_reallocator import AuctionBid, RoleReallocator
from mesh_survival.failure_recovery.stale_heartbeat import HeartbeatTier, StaleHeartbeatTracker
from mesh_survival.networking.adaptive_gossip import (
    GossipMessage,
    MessageUrgency,
    Vector3,
    adaptive_fanout_k,
    gossip_priority,
    rank_neighbors_for_delivery,
)
from mesh_survival.networking.partition_detector import GossipClock, PartitionDetector

__all__ = [
    "AuctionBid",
    "GossipClock",
    "GossipMessage",
    "HeartbeatTier",
    "MessageUrgency",
    "PartitionDetector",
    "RoleReallocator",
    "StaleHeartbeatTracker",
    "Vector3",
    "adaptive_fanout_k",
    "gossip_priority",
    "rank_neighbors_for_delivery",
]
