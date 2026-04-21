"""Leaderless quorum agreement over Vertex gossip (no elected leader)."""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    pass


def quorum_threshold(n: int) -> int:
    """BFT-style quorum: ⌊2n/3⌋ + 1 for n>0."""
    return max(1, (2 * max(n, 1)) // 3 + 1)


class LeaderlessVoteCollector:
    """Collect identical ``choice`` votes for ``proposal_id`` until quorum or timeout."""

    def __init__(self, node_id: str, peer_ids: List[str]) -> None:
        self.node_id = node_id
        self.peer_ids = sorted(peer_ids)
        self._lock = threading.Lock()
        self._votes: Dict[str, Dict[str, str]] = {}
        self._proposal_id: Optional[str] = None

    def record(self, sender: str, msg: Dict[str, Any]) -> None:
        if msg.get("type") != "VERTEX_SWARM_VOTE":
            return
        pid = str(msg.get("proposal_id", ""))
        if pid != self._proposal_id:
            return
        voter = str(msg.get("voter", sender))
        choice = str(msg.get("choice", ""))
        with self._lock:
            self._votes.setdefault(pid, {})[voter] = choice

    def propose_and_collect(
        self,
        broadcast: Any,
        choice: str,
        *,
        wait_s: float = 0.35,
        proposal_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Call ``broadcast(dict)`` once, then poll until quorum (requires inbound ``record``)."""
        pid = proposal_id or f"lv-{self.node_id}-{time.time_ns()}-{uuid.uuid4().hex[:6]}"
        self._proposal_id = pid
        with self._lock:
            self._votes[pid] = {self.node_id: choice}
        q = quorum_threshold(len(self.peer_ids))
        broadcast(
            {
                "type": "VERTEX_SWARM_VOTE",
                "proposal_id": pid,
                "choice": choice,
                "voter": self.node_id,
                "quorum": q,
            }
        )
        deadline = time.monotonic() + wait_s
        while time.monotonic() < deadline:
            with self._lock:
                tally: Dict[str, set[str]] = {}
                for v, ch in self._votes.get(pid, {}).items():
                    tally.setdefault(ch, set()).add(v)
                for ch, voters in tally.items():
                    if len(voters) >= q:
                        return {
                            "proposal_id": pid,
                            "choice": ch,
                            "voters": sorted(voters),
                            "quorum": q,
                            "decided": True,
                        }
            time.sleep(0.02)
        with self._lock:
            return {
                "proposal_id": pid,
                "choice": choice,
                "voters": sorted(self._votes.get(pid, {}).keys()),
                "quorum": q,
                "decided": False,
            }
