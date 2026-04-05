"""Decentralized target discovery, claims, and relay exclusion."""

from __future__ import annotations

import unittest

from swarm.chain_manager import ChainManager, DroneRole
from swarm.drone_controller import DroneController, SimpleMockGPS, SimpleMockRobot
from swarm.exploration import ExplorationManager
from swarm.network_emulator import NetworkEmulator
from swarm.target_manager import Target, TargetManager, _location_key
from swarm.vertex_node import VertexNode


class TestTargetGossip(unittest.TestCase):
    def test_announcement_merges_to_peer(self) -> None:
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

        claimed = []

        def on_claim(_t):
            claimed.append(True)

        t1 = TargetManager("d1", v1, lambda: DroneRole.STANDBY, lambda: (0.0, 0.0, 0.0), on_claim)
        t2 = TargetManager("d2", v2, lambda: DroneRole.STANDBY, lambda: (100.0, 0.0, 0.0), on_claim)
        c1.set_message_handler(lambda s, m: t1.handle_message(s, m))
        c2.set_message_handler(lambda s, m: t2.handle_message(s, m))

        t1.detect_target((50.0, 50.0, 0.0), confidence=1.0)
        self.assertIn("victim_500_500_0", t2.targets)

    def test_closest_wins_claim(self) -> None:
        net = NetworkEmulator()
        v1 = VertexNode("near", net)
        v2 = VertexNode("far", net)
        c1 = ChainManager("near")
        c2 = ChainManager("far")
        net.register("near", lambda s, m: c1.handle_message(s, m))
        net.register("far", lambda s, m: c2.handle_message(s, m))
        e1 = ExplorationManager("near", v1)
        e2 = ExplorationManager("far", v2)
        c1.set_exploration_manager(e1)
        c2.set_exploration_manager(e2)

        assignees = []

        def claim_near(t):
            assignees.append(("near", t.assigned_to))

        def claim_far(t):
            assignees.append(("far", t.assigned_to))

        t_near = TargetManager("near", v1, lambda: DroneRole.STANDBY, lambda: (10.0, 10.0, 0.0), claim_near)
        t_far = TargetManager("far", v2, lambda: DroneRole.STANDBY, lambda: (200.0, 200.0, 0.0), claim_far)
        c1.set_message_handler(lambda s, m: t_near.handle_message(s, m))
        c2.set_message_handler(lambda s, m: t_far.handle_message(s, m))

        t_far.detect_target((12.0, 10.0, 0.0), confidence=1.0)
        tid = next(iter(t_far.targets))
        self.assertEqual(t_near.targets[tid].assigned_to, "near")

    def test_tie_breaker_lexicographic(self) -> None:
        self.assertTrue(TargetManager._claim_wins(5.0, "a", 5.0, "b"))
        self.assertFalse(TargetManager._claim_wins(5.0, "z", 5.0, "a"))

    def test_relay_does_not_claim(self) -> None:
        net = NetworkEmulator()
        v = VertexNode("relay", net)
        c = ChainManager("relay")
        net.register("relay", lambda s, m: c.handle_message(s, m))
        e = ExplorationManager("relay", v)
        c.set_exploration_manager(e)
        c.role = DroneRole.RELAY
        fired = []

        tm = TargetManager("relay", v, lambda: c.role, lambda: (0.0, 0.0, 0.0), lambda _t: fired.append(1))
        c.set_message_handler(lambda s, m: tm.handle_message(s, m))
        tm.detect_target((1.0, 1.0, 0.0), confidence=1.0)
        self.assertEqual(fired, [])
        self.assertIsNone(tm.targets[next(iter(tm.targets))].assigned_to)


class TestDroneRescueIntegration(unittest.TestCase):
    def test_flies_to_victim_and_resolves(self) -> None:
        net = NetworkEmulator()
        vid = "rescuer"
        v = VertexNode(vid, net)
        chain = ChainManager(vid)
        chain.role = DroneRole.STANDBY
        net.register(vid, lambda _s, _m: None)
        victim = (15.0, 0.0, 0.0)
        gps = SimpleMockGPS(0.0, 0.0)
        robot = SimpleMockRobot(gps)
        robot.max_steps = 5000
        dc = DroneController(vid, v, chain, robot, gps, victim_positions=[victim])
        dc.behavior = "rescue"
        loc = victim
        from swarm import config

        tid = f"victim_{_location_key((float(loc[0]), float(loc[1]), float(loc[2])))}"
        t = Target(
            tid,
            (float(loc[0]), float(loc[1]), float(loc[2])),
            0.0,
            1.0,
            vid,
        )
        dc.target_manager.targets[t.id] = t
        dc.target_manager.claimed_target = t.id
        dc.rescue_target = t
        t.assigned_to = vid
        t.assigned_distance = 0.0
        import time as _time

        t.assigned_at = _time.time()

        steps = 0
        while robot.step() and steps < 5000:
            dc.tick()
            steps += 1
            if t.id not in dc.target_manager.targets and dc.behavior == "explore":
                break
        self.assertEqual(dc.behavior, "explore")
        self.assertLess(
            math_hypot(gps.x - victim[0], gps.y - victim[1]),
            config.RESCUE_ARRIVAL_DISTANCE + 2.0,
        )


def math_hypot(ax: float, ay: float) -> float:
    return (ax * ax + ay * ay) ** 0.5


if __name__ == "__main__":
    unittest.main()
