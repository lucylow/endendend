"""Broadcast–vote–agreement over Vertex (P2P fan-out / mesh); optional PBFT total order."""

from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, Tuple

if TYPE_CHECKING:
    from swarm.bft_pbft import PBFTCluster
    from swarm.vertex_node import VertexNode


def stake_amplified_scores(
    stakes: Sequence[float],
    preferences: Sequence[float],
    *,
    temperature: float = 1.0,
) -> List[float]:
    """Turn stakes and unitless preferences into comparable scores (breaks near ties).

    Higher stake amplifies a node's preference (e.g. path quality or vote strength).
    """
    if len(stakes) != len(preferences):
        raise ValueError("stakes and preferences must have the same length")
    t = max(float(temperature), 1e-6)
    out: List[float] = []
    for s, p in zip(stakes, preferences):
        w = max(float(s), 0.0)
        # Softmax-like emphasis: large stakes dominate when preferences are similar.
        out.append(w * float(p) / t)
    return out


def pick_stake_weighted_index(scores: Sequence[float]) -> int:
    """Argmax with deterministic tie-break by index."""
    if not scores:
        raise ValueError("empty scores")
    best_i = 0
    best_v = scores[0]
    for i, v in enumerate(scores[1:], start=1):
        if v > best_v:
            best_v = v
            best_i = i
    return best_i


class ConsensusEngine:
    """Vertex broadcasts for gossip-style proposals/votes; optional in-process PBFT ordering."""

    MSG_PROPOSAL = "COORD_PROPOSAL"
    MSG_VOTE = "COORD_VOTE"

    def __init__(
        self,
        vertex: "VertexNode",
        node_id: str,
        *,
        pbft: Optional["PBFTCluster"] = None,
    ) -> None:
        self.vertex = vertex
        self.node_id = node_id
        self.pbft = pbft

    def broadcast_proposal(
        self,
        proposal_type: str,
        payload: Dict[str, Any],
        *,
        proposal_id: Optional[str] = None,
    ) -> str:
        pid = proposal_id or f"p-{self.node_id}-{time.time_ns()}-{uuid.uuid4().hex[:8]}"
        msg: Dict[str, Any] = {
            "type": self.MSG_PROPOSAL,
            "proposal_id": pid,
            "proposal_type": proposal_type,
            "payload": dict(payload),
            "proposer": self.node_id,
            "_coord_ts": time.time(),
        }
        self.vertex.broadcast(msg)
        return pid

    def broadcast_vote(self, proposal_id: str, choice: str, *, stake: float = 0.0) -> None:
        self.vertex.broadcast(
            {
                "type": self.MSG_VOTE,
                "proposal_id": str(proposal_id),
                "choice": str(choice),
                "voter": self.node_id,
                "stake": float(stake),
                "_coord_ts": time.time(),
            }
        )

    def run_pbft_round(self, proposed_value: str) -> Any:
        """If a PBFT cluster is attached, run one prepare/commit round."""
        if self.pbft is None:
            return None
        return self.pbft.run_consensus_round(proposed_value)

    @staticmethod
    def aggregate_path_votes(
        bids: Sequence[Tuple[str, float, float]],
        *,
        temperature: float = 1.0,
    ) -> Optional[str]:
        """Pick winning agent id from (agent_id, stake, path_score) tuples.

        path_score is higher-is-better (e.g. 1/distance or utility).
        """
        if not bids:
            return None
        ids = [b[0] for b in bids]
        stakes = [b[1] for b in bids]
        prefs = [b[2] for b in bids]
        scores = stake_amplified_scores(stakes, prefs, temperature=temperature)
        i = pick_stake_weighted_index(scores)
        return ids[i]
