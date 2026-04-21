"""P2P task auction (Vertex/FoxMQ mock): distance × battery × capacity."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from mockdata import handoff_protocol
from mockdata.auction_scoring import calculate_bid_score

logger = logging.getLogger(__name__)

Vec3 = Tuple[float, float, float]


class RoverBidInput:
    __slots__ = ("rover_id", "position", "battery", "capacity")

    def __init__(self, rover_id: str, position: Vec3, battery: float, capacity: str) -> None:
        self.rover_id = rover_id
        self.position = position
        self.battery = battery
        self.capacity = capacity


class VertexAuction:
    def __init__(self) -> None:
        self.bids: Dict[str, Dict[str, Any]] = {}
        self.scores: Dict[str, float] = {}
        self.winner: Optional[str] = None
        self.task_coords: Optional[Vec3] = None
        self.task_id: str = "rescue_victim"
        self._broadcast_logged = False

    def reset(self) -> None:
        self.bids.clear()
        self.scores.clear()
        self.winner = None
        self.task_coords = None
        self._broadcast_logged = False

    def broadcast_task(self, victim_coords: Vec3) -> Dict[str, Any]:
        self.task_coords = victim_coords
        msg = handoff_protocol.auction_broadcast(self.task_id, victim_coords)
        if not self._broadcast_logged:
            logger.info("HANDOFF_AUCTION %s", msg)
            self._broadcast_logged = True
        return msg

    def calculate_bid_score(self, rover: RoverBidInput) -> Tuple[float, float]:
        assert self.task_coords is not None
        return calculate_bid_score(rover.position, rover.battery, rover.capacity, self.task_coords)

    def receive_bid(self, rover: RoverBidInput) -> None:
        if self.task_coords is None:
            return
        score, dist = self.calculate_bid_score(rover)
        self.scores[rover.rover_id] = score
        self.bids[rover.rover_id] = {"score": score, "distance": dist}
        handoff_protocol.bid_message(rover.rover_id, dist, rover.battery, rover.capacity)

    def collect_from_rovers(self, rovers: List[RoverBidInput]) -> None:
        for r in rovers:
            self.receive_bid(r)

    def select_winner(self) -> Optional[str]:
        if not self.scores:
            self.winner = None
            return None
        self.winner = max(self.scores.items(), key=lambda kv: kv[1])[0]
        if self.task_coords:
            logger.info(
                "HANDOFF_WINNER %s",
                handoff_protocol.winner_announcement(self.winner, self.task_coords),
            )
        return self.winner
