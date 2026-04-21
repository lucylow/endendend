"""Geometric relay chain proposals committed through replicated state."""

from __future__ import annotations

from typing import List, TYPE_CHECKING

from vertex_swarm.messaging.vertex_channels import Channel

if TYPE_CHECKING:
    from vertex_swarm.core.vertex_node import VertexSwarmNode


class ChainFormation:
    def __init__(self, node: "VertexSwarmNode") -> None:
        self.node = node

    def propose_chain(self, ordered_ids: List[str]) -> str:
        return self.node.submit_event(Channel.CHAIN.value, "chain", ordered_ids, op="chain")
