"""Instant auction failover: highest score wins; failed incumbent → runner-up."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence


@dataclass
class AuctionBid:
    node_id: str
    score: float


class RoleReallocator:
    """Deterministic re-auction when a role holder is declared dead."""

    def __init__(self, role: str) -> None:
        self.role = role

    def pick_winner(self, bids: Sequence[AuctionBid]) -> Optional[AuctionBid]:
        if not bids:
            return None
        return sorted(bids, key=lambda b: (-b.score, b.node_id))[0]

    def reallocate_on_failure(
        self,
        bids: Sequence[AuctionBid],
        failed_node_id: str,
    ) -> Optional[AuctionBid]:
        """Remove failed node; return best remaining bid (2nd overall if leader died)."""
        alive = [b for b in bids if b.node_id != failed_node_id]
        return self.pick_winner(alive)

    def ordered_runners(self, bids: Sequence[AuctionBid]) -> List[AuctionBid]:
        return sorted(bids, key=lambda b: (-b.score, b.node_id))
