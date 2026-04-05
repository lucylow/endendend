"""Simplified PBFT-style consensus with view changes and a total order log.

Designed for simulation/tests: synchronous rounds, no threads. All nodes share
one cluster scheduler. Quorum uses the standard n>=3f+1 rule expressed as
quorum = floor(2n/3)+1 (same as the dashboard store).

Fair ordering: call :meth:`PBFTCluster.order` to assign a monotonic sequence
number only after prepare+commit succeeds for that payload.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Sequence, Set, Tuple


def _quorum_size(n: int) -> int:
    return max(1, (2 * n) // 3 + 1)


def _primary_id(sorted_ids: Sequence[str], view: int) -> str:
    if not sorted_ids:
        raise ValueError("no nodes")
    return sorted_ids[view % len(sorted_ids)]


def deterministic_task_winner(bids: Sequence[Tuple[str, float]]) -> Optional[str]:
    """Lowest distance wins; ties broken by lexicographic node id."""
    if not bids:
        return None
    best_id, best_d = min(bids, key=lambda x: (x[1], x[0]))
    return best_id


class RoundResult(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"


@dataclass
class ConsensusOutcome:
    result: RoundResult
    view: int
    primary: str
    prepare_votes: List[str]
    commit_votes: List[str]
    byzantine_blocked: int
    global_seq: Optional[int] = None


@dataclass
class OrderedEntry:
    seq: int
    view: int
    payload: Dict[str, Any]


class PBFTCluster:
    """In-process multi-node PBFT with rotating primary per view."""

    def __init__(
        self,
        node_ids: Sequence[str],
        byzantine_ids: Optional[Set[str]] = None,
        *,
        committee_size: Optional[int] = None,
    ) -> None:
        self.node_ids = sorted(node_ids)
        self.n = len(self.node_ids)
        self._committee_cap = committee_size
        self.byzantine = set(byzantine_ids or ())
        self.view = 0
        self._ordered: List[OrderedEntry] = []
        self._next_seq = 1
        self._on_view_change: Optional[Callable[[int, str], None]] = None

    def set_view_change_hook(self, fn: Optional[Callable[[int, str], None]]) -> None:
        self._on_view_change = fn

    @property
    def ordered_log(self) -> List[OrderedEntry]:
        return list(self._ordered)

    def active_replicas(self) -> List[str]:
        """Replicas that participate in prepare/commit (committee or full set)."""
        if self._committee_cap is None or self._committee_cap >= self.n:
            return list(self.node_ids)
        k = max(4, min(int(self._committee_cap), self.n))
        return self.node_ids[:k]

    def primary(self) -> str:
        return _primary_id(self.active_replicas(), self.view)

    def quorum(self) -> int:
        return _quorum_size(len(self.active_replicas()))

    def advance_view(self) -> None:
        self.view += 1
        if self._on_view_change:
            self._on_view_change(self.view, self.primary())

    def run_consensus_round(
        self,
        proposed_value: str,
        *,
        validate_prepare: Optional[Callable[[str], bool]] = None,
    ) -> ConsensusOutcome:
        """One prepare/commit attempt at the current view (no automatic retry)."""
        primary = self.primary()
        primary_byz = primary in self.byzantine
        q = self.quorum()
        prepare_votes: List[str] = []
        byz_blocked = 0
        cohort = self.active_replicas()

        for nid in cohort:
            if nid == primary:
                if primary_byz:
                    byz_blocked += 1
                else:
                    prepare_votes.append(nid)
                continue
            if primary_byz:
                # Replicas do not prepare under a Byzantine primary (invalid view).
                continue
            if nid in self.byzantine:
                byz_blocked += 1
                continue
            if validate_prepare is not None and not validate_prepare(proposed_value):
                continue
            prepare_votes.append(nid)

        ok_prepare = len(prepare_votes) >= q
        if not ok_prepare:
            return ConsensusOutcome(
                RoundResult.FAILURE,
                self.view,
                primary,
                prepare_votes,
                [],
                byz_blocked,
                None,
            )

        commit_votes: List[str] = []
        for nid in cohort:
            if nid not in prepare_votes:
                continue
            if nid in self.byzantine:
                continue
            commit_votes.append(nid)

        ok_commit = len(commit_votes) >= q
        if not ok_commit:
            return ConsensusOutcome(
                RoundResult.FAILURE,
                self.view,
                primary,
                prepare_votes,
                commit_votes,
                byz_blocked,
                None,
            )

        seq = self._next_seq
        self._next_seq += 1
        self._ordered.append(
            OrderedEntry(seq=seq, view=self.view, payload={"value": proposed_value})
        )
        return ConsensusOutcome(
            RoundResult.SUCCESS,
            self.view,
            primary,
            prepare_votes,
            commit_votes,
            byz_blocked,
            seq,
        )

    def order(
        self,
        proposed_value: str,
        *,
        validate_prepare: Optional[Callable[[str], bool]] = None,
        max_views: Optional[int] = None,
    ) -> Tuple[Optional[int], List[ConsensusOutcome]]:
        """Run consensus with view changes until success or views exhausted."""
        attempts: List[ConsensusOutcome] = []
        limit = max_views if max_views is not None else self.n
        for _ in range(limit):
            out = self.run_consensus_round(proposed_value, validate_prepare=validate_prepare)
            attempts.append(out)
            if out.result == RoundResult.SUCCESS:
                return out.global_seq, attempts
            self.advance_view()
        return None, attempts

    def order_fast(
        self,
        proposed_value: str,
        *,
        validate_prepare: Optional[Callable[[str], bool]] = None,
        max_fast_views: int = 3,
    ) -> Tuple[Optional[int], List[ConsensusOutcome]]:
        """Latency-oriented ordering: cap view changes so role/task hand-off fails fast."""
        return self.order(
            proposed_value,
            validate_prepare=validate_prepare,
            max_views=max(1, min(int(max_fast_views), self.n)),
        )

    def consensus_task_winner(
        self,
        bids: Sequence[Tuple[str, float]],
        *,
        max_views: Optional[int] = None,
    ) -> Tuple[Optional[str], Optional[int], List[ConsensusOutcome]]:
        """Agree on task assignee; honest nodes only vote if proposal matches deterministic winner."""
        expected = deterministic_task_winner(bids)
        if expected is None:
            return None, None, []

        def validate(val: str) -> bool:
            return val == expected

        seq, attempts = self.order(expected, validate_prepare=validate, max_views=max_views)
        return expected, seq, attempts
