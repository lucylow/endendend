"""Blind handoff: aerial low-battery RESCUE_HANDOFF_REQUEST → bids → accept → rescue (P2P, no cloud)."""

from __future__ import annotations

import unittest

from swarm import config
from swarm.chain_manager import ChainManager, DroneRole
from swarm.drone_controller import DroneController, SimpleMockGPS, SimpleMockRobot
from swarm.network_emulator import NetworkEmulator
from swarm.target_manager import _location_key
from swarm.vertex_node import VertexNode


class TestBlindHandoff(unittest.TestCase):
    def test_closest_ground_wins_and_completes_rescue(self) -> None:
        orig = config.HANDOFF_BID_WINDOW_SEC
        config.HANDOFF_BID_WINDOW_SEC = 3600.0
        try:
            net = NetworkEmulator()
            victim = (10.0, 0.0, 0.0)

            def make_ctrl(
                nid: str,
                xy: tuple[float, float],
                dtype: str,
                victims: list[tuple[float, float, float]],
            ) -> DroneController:
                gps = SimpleMockGPS(xy[0], xy[1])
                robot = SimpleMockRobot(gps)
                robot.max_steps = 12000
                v = VertexNode(nid, net)
                cm = ChainManager(nid)
                cm.role = DroneRole.STANDBY
                dc = DroneController(
                    nid,
                    v,
                    cm,
                    robot,
                    gps,
                    mock_data=None,
                    victim_positions=victims,
                    drone_type=dtype,
                )
                em = ExplorationManager(nid, v)
                cm.set_exploration_manager(em)
                net.register(nid, lambda s, m, chain=cm: chain.handle_message(s, m))
                return dc

            aerial = make_ctrl("aerial", (0.0, 0.0), "aerial", [victim])
            g_close = make_ctrl("g_close", (8.0, 0.0), "ground", [])
            g_far = make_ctrl("g_far", (30.0, 0.0), "ground", [])

            aerial.battery = 15.0
            aerial.low_battery = True
            g_close.battery = 80.0
            g_far.battery = 80.0

            aerial.initiate_handoff(victim)
            self.assertTrue(aerial.pending_handoffs)
            hid = next(iter(aerial.pending_handoffs))
            self.assertGreaterEqual(len(aerial.handoff_bids.get(hid, [])), 2)

            aerial._process_handoff_bids(hid)

            self.assertEqual(g_close.behavior, "rescue")
            self.assertIsNotNone(g_close.current_handoff_rescue)
            self.assertEqual(g_far.behavior, "explore")
            self.assertIsNone(g_far.current_handoff_rescue)

            robots = [aerial.robot, g_close.robot, g_far.robot]
            ctrls = [aerial, g_close, g_far]
            vkey = _location_key(victim)
            for _ in range(8000):
                for r, c in zip(robots, ctrls):
                    if r.step():
                        c.tick()
                if vkey in aerial._rescued_victim_keys:
                    break
                if vkey in g_close._rescued_victim_keys:
                    break
                if g_close.behavior == "explore" and g_close.current_handoff_rescue is None:
                    break

            self.assertIn(vkey, g_close._rescued_victim_keys)
            self.assertLess(abs(g_close.gps.x - victim[0]), config.RESCUE_ARRIVAL_DISTANCE + 1.0)
        finally:
            config.HANDOFF_BID_WINDOW_SEC = orig


if __name__ == "__main__":
    unittest.main()
