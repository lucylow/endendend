"""Utility-weighted role assignment via FoxMQ bids + Vertex state commit."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from vertex_swarm.messaging.vertex_channels import Channel

if TYPE_CHECKING:
    from vertex_swarm.core.vertex_node import VertexSwarmNode


@dataclass
class RoleBid:
    bidder_id: str
    role: str
    utility: float


class RoleNegotiation:
    def __init__(self, node: "VertexSwarmNode") -> None:
        self.node = node

    def publish_bid(self, role: str, utility: float) -> None:
        from swarm.foxmq_integration import FoxMQTopic, MessageKind

        self.node.foxmq.publish(
            MessageKind.TASK_BID,
            FoxMQTopic.TASK_BID,
            {"bidder_id": self.node.node_id, "role": role, "utility": float(utility)},
        )

    def pick_winner(self, bids: List[RoleBid]) -> Optional[str]:
        if not bids:
            return None
        best = max(bids, key=lambda b: (b.utility, b.bidder_id))
        return best.bidder_id

    def commit_role(self, drone_id: str, role: str) -> str:
        return self.node.submit_event(Channel.ROLES.value, drone_id, role, op="role")
