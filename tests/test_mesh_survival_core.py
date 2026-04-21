"""Mesh survival package: gossip, heartbeats, roles, topology, partition merge."""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mesh_survival.failure_recovery.chain_rebuilder import ChainProposal, ChainRebuilder, GeometryVote
from mesh_survival.failure_recovery.role_reallocator import AuctionBid, RoleReallocator
from mesh_survival.failure_recovery.stale_heartbeat import (
    HeartbeatTier,
    StaleHeartbeatTracker,
    tier_from_age_ms,
    voting_weight,
)
from mesh_survival.networking.adaptive_gossip import (
    GossipMessage,
    MessageUrgency,
    Vector3,
    adaptive_fanout_k,
    gossip_priority,
    rank_neighbors_for_delivery,
    top_k_neighbors,
    ttl_decay,
)
from mesh_survival.networking.partition_detector import GossipClock, PartitionDetector
from mesh_survival.topology.connectivity_matrix import ConnectivityMatrix
from mesh_survival.topology.relay_optimizer import widest_path_capacity
from mesh_survival.validation.partition_sim import merge_partitions
from mesh_survival.validation.resilience_benchmark import quick_resilience_suite


def test_adaptive_fanout_monotone() -> None:
    assert adaptive_fanout_k(0.0) <= adaptive_fanout_k(0.45)
    assert adaptive_fanout_k(0.45) <= adaptive_fanout_k(0.9)
    assert adaptive_fanout_k(0.9) == 8


def test_geometric_gossip_prefers_neighbors_toward_target() -> None:
    self_pos = Vector3(0.0, 0.0, 0.0)
    target = Vector3(10.0, 0.0, 0.0)
    neighbors = {
        "far": Vector3(-5.0, 0.0, 0.0),
        "near": Vector3(8.0, 0.0, 0.0),
    }
    msg = GossipMessage(
        urgency=MessageUrgency.VICTIM_FOUND,
        created_mono=time.monotonic(),
        msg_id="m1",
        signed_duplicate_key="sig1",
        payload={},
    )
    ranked = rank_neighbors_for_delivery(msg, self_pos, target, neighbors)
    assert ranked[0][0] == "near"


def test_top_k_respects_loss() -> None:
    msg = GossipMessage(
        urgency=MessageUrgency.HEARTBEAT,
        created_mono=time.monotonic(),
        msg_id="m2",
        signed_duplicate_key="sig2",
        payload={},
    )
    here = Vector3(0, 0, 0)
    tgt = Vector3(5, 0, 0)
    npos = {f"n{i}": Vector3(float(i), 0, 0) for i in range(10)}
    ranked = rank_neighbors_for_delivery(msg, here, tgt, npos)
    low = top_k_neighbors(ranked, 3, loss=0.1)
    high = top_k_neighbors(ranked, 3, loss=0.9)
    assert len(high) >= len(low)


def test_heartbeat_tiers() -> None:
    assert tier_from_age_ms(50) == HeartbeatTier.GREEN
    assert tier_from_age_ms(250) == HeartbeatTier.YELLOW
    assert tier_from_age_ms(800) == HeartbeatTier.RED
    assert tier_from_age_ms(3000) == HeartbeatTier.BLACK
    assert voting_weight(HeartbeatTier.GREEN) == 1.0
    assert voting_weight(HeartbeatTier.RED) == 0.0


def test_stale_tracker_age() -> None:
    tr = StaleHeartbeatTracker(now_fn=lambda: 1000.0)
    tr.record_fast("p1", now=1000.0)
    assert tr.tier("p1", now=1000.15) == HeartbeatTier.GREEN
    assert tr.tier("p1", now=1000.35) == HeartbeatTier.YELLOW


def test_role_reallocate_runner_up() -> None:
    r = RoleReallocator("relay")
    bids = [
        AuctionBid("a", 10.0),
        AuctionBid("b", 8.0),
        AuctionBid("c", 7.0),
    ]
    assert r.pick_winner(bids).node_id == "a"
    nxt = r.reallocate_on_failure(bids, "a")
    assert nxt is not None and nxt.node_id == "b"


def test_partition_merge_monotonic() -> None:
    m = merge_partitions({"x": 5, "y": 2}, {"x": 3, "y": 4, "z": 1})
    assert m["x"] == 5 and m["y"] == 4 and m["z"] == 1


def test_partition_detector_divergence() -> None:
    d = PartitionDetector(divergence_threshold=5)
    st, div = d.status({"a": 10}, {"a": 3})
    assert div == 7 and st == "PARTITIONED"


def test_widest_path() -> None:
    m = ConnectivityMatrix()
    m.set_link("base", "r1", latency_ms=10, delivery=0.5)
    m.set_link("r1", "exp", latency_ms=10, delivery=0.6)
    cap, path = widest_path_capacity(m, "base", "exp")
    assert path == ["base", "r1", "exp"]
    assert abs(cap - 0.5) < 1e-6


def test_chain_rebuilder_tally() -> None:
    cr = ChainRebuilder()
    votes = [
        GeometryVote("v1", "p1", 1.0),
        GeometryVote("v2", "p1", 0.5),
        GeometryVote("v3", "p2", 2.0),
    ]
    proposals = {
        "p1": ChainProposal("p1", ("a", "b"), "x"),
        "p2": ChainProposal("p2", ("a", "c"), "x"),
    }
    best = cr.finalize(proposals, votes)
    assert best is not None and best.proposal_id == "p2"


def test_resilience_suite_smoke() -> None:
    stats = quick_resilience_suite(runs=40, loss=0.9)
    assert stats["pass_rate"] >= 0.0
    assert stats["fanout_at_loss"] == 8
