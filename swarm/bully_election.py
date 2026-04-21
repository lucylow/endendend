"""Bully algorithm for decentralized explorer election.

Implements depth-based leader election with deterministic tie-breaking (lexicographic drone ID).
Supports automatic re-election on explorer timeout.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

LOG = logging.getLogger(__name__)


class ElectionState(Enum):
    """Election process states."""
    IDLE = "idle"
    ELECTION_IN_PROGRESS = "election_in_progress"
    ELECTED = "elected"
    FOLLOWER = "follower"


@dataclass(slots=True)
class CandidateInfo:
    """Information about a candidate in the election."""
    node_id: str
    depth: float
    priority: float = 0.0  # Higher depth = higher priority (deeper = closer to target)
    battery: float = 100.0
    last_seen_ms: int = 0
    is_alive: bool = True

    def __lt__(self, other: CandidateInfo) -> bool:
        """Compare candidates: depth first, then battery, then lexicographic ID."""
        if self.depth != other.depth:
            return self.depth > other.depth  # Higher depth = better (deeper)
        if self.battery != other.battery:
            return self.battery > other.battery  # Higher battery = better
        return self.node_id < other.node_id  # Lexicographic tie-break


class BullyElection:
    """Decentralized bully algorithm for explorer role election."""

    def __init__(
        self,
        node_id: str,
        all_nodes: List[str],
        *,
        depth: float = 0.0,
        battery: float = 100.0,
        election_timeout_s: float = 5.0,
        heartbeat_timeout_s: float = 10.0,
        on_elected: Optional[Callable[[], None]] = None,
        on_lost_election: Optional[Callable[[], None]] = None,
    ) -> None:
        self.node_id = node_id
        self.all_nodes = sorted(all_nodes)
        self.depth = depth
        self.battery = battery
        self.election_timeout_s = election_timeout_s
        self.heartbeat_timeout_s = heartbeat_timeout_s
        self.on_elected = on_elected
        self.on_lost_election = on_lost_election

        self.state = ElectionState.IDLE
        self.current_leader: Optional[str] = None
        self._candidates: Dict[str, CandidateInfo] = {}
        self._election_start_ms = 0
        self._last_heartbeat_from_leader_ms = 0
        self._votes_received: Set[str] = set()
        self._higher_priority_exists = False

    def start_election(self) -> None:
        """Initiate a new election round."""
        LOG.info(f"[{self.node_id}] Starting election (depth={self.depth}, battery={self.battery})")
        self.state = ElectionState.ELECTION_IN_PROGRESS
        self._election_start_ms = int(time.time() * 1000)
        self._votes_received.clear()
        self._higher_priority_exists = False
        self._candidates.clear()

        # Add self as candidate
        self._candidates[self.node_id] = CandidateInfo(
            node_id=self.node_id,
            depth=self.depth,
            battery=self.battery,
            last_seen_ms=self._election_start_ms,
            is_alive=True,
        )

    def receive_election_message(self, sender: str, depth: float, battery: float) -> None:
        """Receive election participation message from a peer."""
        now_ms = int(time.time() * 1000)
        sender_info = CandidateInfo(
            node_id=sender,
            depth=depth,
            battery=battery,
            last_seen_ms=now_ms,
            is_alive=True,
        )

        self._candidates[sender] = sender_info

        # Check if sender has higher priority
        self_info = CandidateInfo(
            node_id=self.node_id,
            depth=self.depth,
            battery=self.battery,
            last_seen_ms=now_ms,
        )

        if sender_info < self_info:  # sender has higher priority
            self._higher_priority_exists = True
            LOG.debug(f"[{self.node_id}] Higher priority candidate found: {sender}")

    def receive_election_win(self, leader_id: str, depth: float, battery: float) -> None:
        """Receive election win announcement from a peer."""
        now_ms = int(time.time() * 1000)
        self.current_leader = leader_id
        self._last_heartbeat_from_leader_ms = now_ms
        self.state = ElectionState.FOLLOWER
        self._candidates[leader_id] = CandidateInfo(
            node_id=leader_id,
            depth=depth,
            battery=battery,
            last_seen_ms=now_ms,
            is_alive=True,
        )
        LOG.info(f"[{self.node_id}] Accepted leader: {leader_id}")
        if self.on_lost_election:
            self.on_lost_election()

    def declare_victory(self) -> None:
        """Declare self as elected leader."""
        self.state = ElectionState.ELECTED
        self.current_leader = self.node_id
        self._last_heartbeat_from_leader_ms = int(time.time() * 1000)
        LOG.info(f"[{self.node_id}] Elected as leader")
        if self.on_elected:
            self.on_elected()

    def tick(self, now_ms: Optional[int] = None) -> Optional[str]:
        """
        Process election state machine.
        Returns elected leader ID if election completes, None otherwise.
        """
        if now_ms is None:
            now_ms = int(time.time() * 1000)

        # Check if current leader has timed out
        if self.current_leader is not None and self.current_leader != self.node_id:
            elapsed_ms = now_ms - self._last_heartbeat_from_leader_ms
            if elapsed_ms > self.heartbeat_timeout_s * 1000:
                LOG.warning(f"[{self.node_id}] Leader {self.current_leader} timeout; restarting election")
                self.start_election()

        # If election in progress, check timeout
        if self.state == ElectionState.ELECTION_IN_PROGRESS:
            elapsed_ms = now_ms - self._election_start_ms
            if elapsed_ms > self.election_timeout_s * 1000:
                # Election timeout: determine winner
                return self._finalize_election(now_ms)

        return None

    def _finalize_election(self, now_ms: int) -> Optional[str]:
        """Finalize election and determine winner."""
        if not self._candidates:
            LOG.warning(f"[{self.node_id}] No candidates in election")
            return None

        # Find candidate with highest priority
        candidates_list = list(self._candidates.values())
        candidates_list.sort()  # Sort by priority (depth, battery, ID)
        winner = candidates_list[0]

        LOG.info(f"[{self.node_id}] Election finalized: winner={winner.node_id}")

        if winner.node_id == self.node_id:
            self.declare_victory()
        else:
            self.receive_election_win(winner.node_id, winner.depth, winner.battery)

        self.state = ElectionState.FOLLOWER if winner.node_id != self.node_id else ElectionState.ELECTED
        self.current_leader = winner.node_id
        return winner.node_id

    def update_local_state(self, depth: float, battery: float) -> None:
        """Update local drone state (depth, battery)."""
        self.depth = depth
        self.battery = battery
        if self.node_id in self._candidates:
            self._candidates[self.node_id].depth = depth
            self._candidates[self.node_id].battery = battery

    def get_election_state(self) -> Dict[str, Any]:
        """Get current election state for debugging/UI."""
        return {
            "node_id": self.node_id,
            "state": self.state.value,
            "current_leader": self.current_leader,
            "candidates": {
                cid: {
                    "depth": c.depth,
                    "battery": c.battery,
                    "is_alive": c.is_alive,
                }
                for cid, c in self._candidates.items()
            },
            "higher_priority_exists": self._higher_priority_exists,
        }

    def get_current_leader(self) -> Optional[str]:
        """Get the current elected leader."""
        return self.current_leader

    def is_leader(self) -> bool:
        """Check if this node is the current leader."""
        return self.current_leader == self.node_id

    def is_follower(self) -> bool:
        """Check if this node is a follower."""
        return self.state == ElectionState.FOLLOWER

    def is_election_in_progress(self) -> bool:
        """Check if an election is currently in progress."""
        return self.state == ElectionState.ELECTION_IN_PROGRESS
