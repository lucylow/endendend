"""Unit tests for modular coordination (heartbeat, consensus helpers, coordinator)."""

from __future__ import annotations

import time
import unittest

from swarm.bft_pbft import PBFTCluster, RoundResult
from swarm.chain_manager import ChainManager, DroneRole
from swarm.coordination.consensus_engine import ConsensusEngine, stake_amplified_scores
from swarm.coordination.heartbeat_monitor import HeartbeatMonitor
from swarm.coordination.swarm_coordinator import SwarmCoordinator
from swarm.network_emulator import NetworkEmulator
from swarm.vertex_node import VertexNode


class TestHeartbeatMonitor(unittest.TestCase):
    def test_stale_and_dead_callbacks(self) -> None:
        t0 = 1000.0
        hb = HeartbeatMonitor(stale_sec=1.0, dead_sec=3.0, now_fn=lambda: t0)
        stale_hits: list[str] = []
        dead_hits: list[str] = []
        hb.record("a", now=t0, stake=10)
        hb.tick(now=t0 + 0.5, on_stale=lambda p: stale_hits.append(p), on_dead=lambda p: dead_hits.append(p))
        self.assertEqual(stale_hits, [])
        self.assertEqual(dead_hits, [])
        hb.tick(now=t0 + 2.0, on_stale=lambda p: stale_hits.append(p), on_dead=lambda p: dead_hits.append(p))
        self.assertEqual(stale_hits, ["a"])
        self.assertEqual(dead_hits, [])
        newly = hb.tick(now=t0 + 4.5, on_stale=lambda _: None, on_dead=lambda p: dead_hits.append(p))
        self.assertEqual(newly, ["a"])
        self.assertEqual(dead_hits, ["a"])

    def test_revive_clears_dead(self) -> None:
        hb = HeartbeatMonitor(stale_sec=0.1, dead_sec=0.2, now_fn=time.time)
        now = time.time()
        hb.record("x", now=now, stake=1)
        hb.tick(now=now + 1.0)
        self.assertFalse(hb.is_alive("x", now=now + 1.0))
        hb.record("x", now=now + 2.0, stake=1)
        self.assertTrue(hb.is_alive("x", now=now + 2.0))


class TestStakeAmplification(unittest.TestCase):
    def test_near_tie_prefers_higher_stake(self) -> None:
        stakes = [100.0, 100.0]
        prefs = [0.51, 0.49]
        scores = stake_amplified_scores(stakes, prefs, temperature=1.0)
        self.assertGreater(scores[0], scores[1])

    def test_aggregate_path_votes(self) -> None:
        winner = ConsensusEngine.aggregate_path_votes(
            [("low", 10.0, 0.9), ("high", 500.0, 0.5)],
            temperature=1.0,
        )
        self.assertEqual(winner, "high")


class TestConsensusEngineBroadcast(unittest.TestCase):
    def test_proposal_and_vote_hit_emulator(self) -> None:
        emu = NetworkEmulator(packet_loss=0.0)
        emu.register_node("n1")
        emu.register_node("n2")
        v1 = VertexNode("n1", emulator=emu)
        v2 = VertexNode("n2", emulator=emu)
        seen: list[dict] = []

        def h(_sender: str, msg: dict) -> None:
            seen.append(msg)

        v2.set_message_handler(h)
        ce = ConsensusEngine(v1, "n1")
        pid = ce.broadcast_proposal("path", {"k": 1})
        ce.broadcast_vote(pid, "opt-A", stake=200)
        self.assertTrue(any(m.get("type") == "COORD_PROPOSAL" for m in seen))
        self.assertTrue(any(m.get("type") == "COORD_VOTE" for m in seen))


class TestSwarmCoordinatorPromotion(unittest.TestCase):
    def test_promote_highest_stake(self) -> None:
        emu = NetworkEmulator(packet_loss=0.0)
        emu.register_node("s2")
        v = VertexNode("s2", emulator=emu)
        chain = ChainManager("s2")
        coord = SwarmCoordinator("s2", v, chain)
        stakes = {"s1": 10.0, "s2": 99.0}
        best = coord.promote_standby_to_role(
            "failed",
            ["s1", "s2"],
            target_role=DroneRole.RELAY,
            stake_for=lambda i: stakes[i],
            now=1_000.0,
        )
        self.assertEqual(best, "s2")
        self.assertEqual(chain.role, DroneRole.RELAY)


class TestConsensusEnginePbft(unittest.TestCase):
    def test_optional_pbft_round(self) -> None:
        emu = NetworkEmulator(packet_loss=0.0)
        emu.register_node("a")
        v = VertexNode("a", emulator=emu)
        cluster = PBFTCluster(["a", "b", "c"])
        ce = ConsensusEngine(v, "a", pbft=cluster)
        out = ce.run_pbft_round("commit-me")
        self.assertIsNotNone(out)
        self.assertEqual(out.result, RoundResult.SUCCESS)


if __name__ == "__main__":
    unittest.main()
