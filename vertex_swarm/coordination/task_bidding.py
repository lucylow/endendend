"""Leaderless task allocation from distance / priority tuples."""

from __future__ import annotations

from typing import List, Optional, Sequence, Tuple, TYPE_CHECKING

from swarm.bft_pbft import PBFTCluster, deterministic_task_winner

if TYPE_CHECKING:
    from vertex_swarm.core.vertex_node import VertexSwarmNode


class TaskBidding:
    def __init__(self, node: "VertexSwarmNode") -> None:
        self.node = node

    def consensus_winner(
        self,
        bids: Sequence[Tuple[str, float]],
        *,
        committee: Optional[Sequence[str]] = None,
    ) -> Optional[str]:
        """PBFT-ordered winner among bidders (same helper as ``swarm`` tests)."""
        ids = list(committee) if committee is not None else sorted({b[0] for b in bids})
        if len(ids) < 4:
            return deterministic_task_winner(list(bids))
        c = PBFTCluster(ids)
        w, _seq, _ = c.consensus_task_winner(list(bids))
        return w
