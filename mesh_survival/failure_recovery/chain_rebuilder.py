"""Geometry proposal + utility votes → NEW_CHAIN consensus payload (parallel-friendly)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Mapping, Optional, Sequence, Tuple

from mesh_survival.networking.vertex_resilient import virtual_vote_tally


@dataclass
class GeometryVote:
    voter: str
    proposal_id: str
    utility: float


@dataclass
class ChainProposal:
    proposal_id: str
    ordered_nodes: Tuple[str, ...]
    proposer: str


class ChainRebuilder:
    def __init__(self, quorum: int = 1) -> None:
        self.quorum = max(1, int(quorum))

    def tally(self, votes: Sequence[GeometryVote]) -> Optional[str]:
        """Return winning proposal_id by summed utility (simple BFT-friendly score)."""
        score: Dict[str, float] = {}
        for v in votes:
            score[v.proposal_id] = score.get(v.proposal_id, 0.0) + float(v.utility)
        if not score:
            return None
        best = max(score.items(), key=lambda kv: kv[1])
        return best[0] if best[1] > 0 else None

    def finalize(
        self,
        proposals: Mapping[str, ChainProposal],
        votes: Sequence[GeometryVote],
    ) -> Optional[ChainProposal]:
        pid = self.tally(votes)
        if pid is None:
            return None
        return proposals.get(pid)

    def virtual_finalize(self, vote_payloads: List[Mapping[str, object]]) -> Tuple[str, int]:
        """Reuse heartbeat/state slots to carry votes (virtual_vote_tally)."""
        return virtual_vote_tally(vote_payloads, proposal_key="proposal_id", voter_key="voter")
