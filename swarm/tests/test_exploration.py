"""Unit tests for decentralized exploration (run: PYTHONPATH=. python -m unittest swarm.tests.test_exploration)."""

from __future__ import annotations

import time
import unittest

from swarm.chain_manager import ChainManager, DroneRole
from swarm.drone_controller import DroneController, SimpleMockGPS, SimpleMockRobot
from swarm.exploration import ExplorationManager, GridMap, GridMap1D
from swarm.network_emulator import NetworkEmulator
from swarm.vertex_node import VertexNode


class TestGridMap(unittest.TestCase):
    def test_cell_from_position_clamps(self) -> None:
        g = GridMap()
        # WORLD_BOUNDS 0..500, cell 5m -> 100 cells; far outside clamps
        self.assertEqual(g.cell_from_position(-1000, -1000), (0, 0))
        self.assertEqual(g.cell_from_position(10_000, 10_000), (99, 99))

    def test_mark_explored_clears_claim(self) -> None:
        g = GridMap()
        g.claim_for_self((3, 4), "a")
        self.assertIn((3, 4), g.claimed)
        g.mark_explored((3, 4))
        self.assertNotIn((3, 4), g.claimed)
        self.assertTrue(g.is_explored((3, 4)))

    def test_stale_claim_not_blocking(self) -> None:
        g = GridMap(claim_timeout=0.05)
        g.set_foreign_claim((1, 1), "peer", ts=time.time() - 1.0)
        self.assertFalse(g.is_blocked_for((1, 1), "me"))


class TestExplorationGossip(unittest.TestCase):
    def test_two_nodes_merge_explored(self) -> None:
        net = NetworkEmulator()
        v1 = VertexNode("d1", net)
        v2 = VertexNode("d2", net)
        c1 = ChainManager("d1")
        c2 = ChainManager("d2")
        net.register("d1", lambda s, m: c1.handle_message(s, m))
        net.register("d2", lambda s, m: c2.handle_message(s, m))

        e1 = ExplorationManager("d1", v1)
        e2 = ExplorationManager("d2", v2)
        c1.set_exploration_manager(e1)
        c2.set_exploration_manager(e2)

        e1.map.mark_explored((2, 2))
        e2.map.mark_explored((5, 5))
        e2._broadcast_updates()

        self.assertTrue(e1.map.is_explored((2, 2)))
        self.assertTrue(e1.map.is_explored((5, 5)))

    def test_peer_claim_blocks_target_choice(self) -> None:
        net = NetworkEmulator()
        v1 = VertexNode("d1", net)
        c1 = ChainManager("d1")
        net.register("d1", lambda s, m: c1.handle_message(s, m))
        e1 = ExplorationManager("d1", v1)
        c1.set_exploration_manager(e1)

        # Shrink search: mark all but (0,0) and (1,0) explored would be heavy; instead inject foreign claim on (0,0)
        e1.map.set_foreign_claim((0, 0), "d2", ts=time.time())
        # Position at cell (0,0) center -> nearest free cell should skip (0,0)
        cx, cy = e1.map.cell_center_meters((0, 0))
        t = e1.choose_next_target((cx, cy))
        self.assertIsNotNone(t)
        self.assertNotEqual(t, (0, 0))


class TestDroneControllerExplore(unittest.TestCase):
    def test_reaches_cell_and_marks_explored(self) -> None:
        net = NetworkEmulator()
        vid = "solo"
        v = VertexNode(vid, net)
        chain = ChainManager(vid)
        net.register(vid, lambda _s, _m: None)
        gps = SimpleMockGPS(2.5, 2.5)  # center of cell (0,0)
        robot = SimpleMockRobot(gps)
        robot.max_steps = 500
        dc = DroneController(vid, v, chain, robot, gps)
        dc.chain_mgr.role = DroneRole.EXPLORER

        steps = 0
        while robot.step() and steps < 500:
            dc.tick()
            steps += 1
            if (0, 0) in dc.exploration.map.explored:
                break
        self.assertTrue(dc.exploration.map.is_explored((0, 0)))


class TestGridMap1D(unittest.TestCase):
    def test_cell_from_depth(self) -> None:
        g = GridMap1D(tunnel_length=100, cell_size=10)
        self.assertEqual(g.num_cells, 10)
        self.assertEqual(g.cell_from_depth(25), 2)


if __name__ == "__main__":
    unittest.main()
