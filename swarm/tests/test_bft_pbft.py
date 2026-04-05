"""Tests for PBFT cluster, view changes, ordering, and task-winner consensus."""

from swarm.bft_pbft import (
    PBFTCluster,
    RoundResult,
    deterministic_task_winner,
)


def test_quorum_five_nodes():
    c = PBFTCluster(["a", "b", "c", "d", "e"])
    assert c.quorum() == 4


def test_task_winner_tiebreak():
    assert deterministic_task_winner([("b", 2.0), ("a", 2.0)]) == "a"


def test_consensus_success_all_honest():
    c = PBFTCluster(["a", "b", "c", "d"])
    out = c.run_consensus_round("explorer-a")
    assert out.result == RoundResult.SUCCESS
    assert out.global_seq == 1
    assert len(c.ordered_log) == 1


def test_view_change_until_honest_primary():
    # Primary "a" is Byzantine; rotate until primary is honest (e.g. "b")
    c = PBFTCluster(["a", "b", "c", "d"], byzantine_ids={"a"})
    seq, attempts = c.order("val", max_views=4)
    assert seq == 1
    assert attempts[-1].result == RoundResult.SUCCESS
    assert attempts[0].result == RoundResult.FAILURE


def test_order_fast_caps_views():
    c = PBFTCluster(["a", "b", "c", "d"], byzantine_ids={"a"})
    seq, attempts = c.order_fast("val", max_fast_views=2)
    assert seq is None or len(attempts) <= 2


def test_committee_runs_on_subset():
    ids = [f"n{i}" for i in range(10)]
    c = PBFTCluster(ids, committee_size=4)
    assert len(c.active_replicas()) == 4
    out = c.run_consensus_round("x")
    assert out.result == RoundResult.SUCCESS


def test_task_consensus_with_one_byzantine_bidder():
    bids = [("a", 1.0), ("b", 5.0), ("c", 2.0)]
    # Byzantine "a" is also the distance winner; view 0 primary "a" fails, view 1 agrees on "a".
    c = PBFTCluster(["a", "b", "c", "d"], byzantine_ids={"a"})
    winner, seq, _ = c.consensus_task_winner(bids)
    assert winner == "a"
    assert seq == 1
