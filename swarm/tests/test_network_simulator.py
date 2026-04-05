"""NetworkSimulator + impaired NetworkEmulator (PYTHONPATH=. python -m unittest swarm.tests.test_network_simulator)."""

from __future__ import annotations

import json
import time
import unittest

from swarm.chain_manager import ChainManager
from swarm.drone_controller import DroneController, SimpleMockGPS, SimpleMockRobot
from swarm.exploration import ExplorationManager
from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import (
    MockDataGenerator,
    NetworkSimulator,
    ScenarioRunner,
    start_mesh_stats_http_server,
)
from swarm.scenario_dynamic_daisy_chain import load_scenario1_baseline_events
from swarm.vertex_node import VertexNode


class TestNetworkSimulator(unittest.TestCase):
    def test_high_loss_blocks_delivery(self) -> None:
        sim = NetworkSimulator()
        sim.set_default_open(False)
        sim.set_link("a", "b", loss=1.0, latency=0.0, status="up")
        self.assertFalse(sim.should_deliver("a", "b", {"type": "ping"}))

    def test_default_open_delivers(self) -> None:
        sim = NetworkSimulator()
        self.assertTrue(sim.should_deliver("x", "y", {"type": "ping"}))

    def test_unicast_reaches_only_destination(self) -> None:
        net = NetworkEmulator()
        got: list[tuple[str, dict]] = []

        def h1(_s, m):
            got.append(("d1", m))

        def h2(_s, m):
            got.append(("d2", m))

        net.register("d1", h1)
        net.register("d2", h2)
        net.unicast("d2", "d1", {"type": "HANDOFF_BID", "x": 1})
        self.assertEqual(got, [("d1", {"type": "HANDOFF_BID", "x": 1})])

    def test_down_status_blocks(self) -> None:
        sim = NetworkSimulator()
        sim.set_link("a", "b", loss=0.0, latency=0.0, status="down")
        self.assertFalse(sim.should_deliver("a", "b", {"type": "ping"}))

    def test_scenario_runner_applies_events(self) -> None:
        sim = NetworkSimulator()
        sim.set_default_open(False)
        events = [
            {"time": 0.0, "type": "set_link", "src": "a", "dst": "b", "loss": 0.0, "status": "up"},
        ]
        ScenarioRunner(sim, events).run_blocking()
        self.assertTrue(sim.should_deliver("a", "b", {"type": "ping"}))

    def test_scenario_json_parses_like_file(self) -> None:
        raw = '[{"time": 0, "type": "set_link", "src": "p", "dst": "q", "loss": 0.5, "status": "up"}]'
        sim = NetworkSimulator()
        sim.set_default_open(False)
        ScenarioRunner(sim, json.loads(raw)).run_blocking()
        self.assertIn(("p", "q"), sim.links)

    def test_scenario1_baseline_json_loads(self) -> None:
        events = load_scenario1_baseline_events()
        self.assertGreaterEqual(len(events), 3)
        sim = NetworkSimulator()
        ScenarioRunner(sim, events).run_blocking()
        self.assertIn(("d4", "d0"), sim.links)
        self.assertIn(("d0", "d4"), sim.links)
        self.assertLess(float(sim.links[("d4", "d0")]["loss"]), 1.0)

    def test_gossip_blocked_by_lossy_link(self) -> None:
        sim = NetworkSimulator()
        net = NetworkEmulator(sim)
        v1 = VertexNode("d1", net)
        v2 = VertexNode("d2", net)
        c1 = ChainManager("d1")
        c2 = ChainManager("d2")
        net.register("d1", lambda s, m: c1.handle_message(s, m))
        net.register("d2", lambda s, m: c2.handle_message(s, m))
        sim.set_link("d2", "d1", loss=1.0, latency=0.0, status="up")
        sim.set_link("d1", "d2", loss=0.0, latency=0.0, status="up")

        e1 = ExplorationManager("d1", v1)
        e2 = ExplorationManager("d2", v2)
        c1.set_exploration_manager(e1)
        c2.set_exploration_manager(e2)

        e2.map.mark_explored((7, 7))
        e2.vertex.broadcast(
            {"type": "EXPLORATION_UPDATE", "cells": [[7, 7]], "claims": [], "sender": "d2"}
        )
        self.assertFalse(e1.map.is_explored((7, 7)))

    def test_mock_aerial_victim(self) -> None:
        gen = MockDataGenerator("aerial-1", (0.0, 10.0, 0.0, 10.0), victim_interval=0.0, seed=1)
        t0 = time.time()
        v1 = gen.generate(t0 + 1)
        self.assertIsNotNone(v1)
        self.assertEqual(v1.get("type"), "VICTIM_DETECTED")
        self.assertIn("drone_id", v1)
        self.assertIn("battery_pct", v1)

    def test_mock_drone_prefix_generates_events(self) -> None:
        """Drones with 'drone_' prefix should also generate mock events."""
        gen = MockDataGenerator("drone_0", (0.0, 50.0, 0.0, 50.0), victim_interval=0.0, hazard_interval=0.0, environment_interval=0.0, heartbeat_interval=0.0, seed=7)
        t0 = time.time()
        events = gen.generate_all(t0 + 1)
        types = {e["type"] for e in events}
        self.assertIn("VICTIM_DETECTED", types)
        self.assertIn("HAZARD_DETECTED", types)
        self.assertIn("ENVIRONMENT_READING", types)
        self.assertIn("HEARTBEAT_MOCK", types)

    def test_mock_hazard_fields(self) -> None:
        gen = MockDataGenerator("drone_1", (0.0, 10.0, 0.0, 10.0), victim_interval=999, hazard_interval=0.0, seed=3)
        t0 = time.time()
        # First call returns victim (interval=999 so skipped), then hazard
        ev = gen.generate(t0 + 1)
        # With victim_interval=999, victim is skipped, hazard fires
        if ev and ev["type"] == "HAZARD_DETECTED":
            self.assertIn("hazard", ev)
            self.assertIn("severity", ev)
            self.assertIn(ev["severity"], ["low", "medium", "high", "critical"])

    def test_mock_battery_drain(self) -> None:
        gen = MockDataGenerator("drone_2", (0.0, 10.0, 0.0, 10.0), seed=1)
        self.assertAlmostEqual(gen.battery_pct, 100.0)
        gen.tick_battery(1000.0)  # drain for 1000 seconds
        self.assertLess(gen.battery_pct, 100.0)
        self.assertGreaterEqual(gen.battery_pct, 0.0)

    def test_mesh_stats_server(self) -> None:
        sim = NetworkSimulator("t")
        srv = start_mesh_stats_http_server(sim, host="127.0.0.1", port=0)
        port = srv.server_address[1]
        try:
            import urllib.request

            with urllib.request.urlopen(f"http://127.0.0.1:{port}/mesh_stats", timeout=2) as r:
                body = r.read().decode("utf-8")
            data = json.loads(body)
            self.assertEqual(data["mesh_id"], "t")
            self.assertIn("links", data)
        finally:
            srv.shutdown()


class TestDroneControllerMeshHooks(unittest.TestCase):
    def test_mesh_callback_fires(self) -> None:
        sim = NetworkSimulator()
        net = NetworkEmulator(sim)
        vid = "solo"
        v = VertexNode(vid, net)
        chain = ChainManager(vid)
        net.register(vid, lambda _s, _m: None)
        gps = SimpleMockGPS(2.5, 2.5)
        robot = SimpleMockRobot(gps)
        robot.max_steps = 3
        snapshots: list = []

        def cb(snap: dict) -> None:
            snapshots.append(snap)

        dc = DroneController(
            vid,
            v,
            chain,
            robot,
            gps,
            network_sim=sim,
            mesh_stats_interval=0.001,
            mesh_stats_callback=cb,
        )
        steps = 0
        while robot.step() and steps < 20:
            dc.tick()
            steps += 1
            if len(snapshots) >= 1:
                break
        self.assertTrue(len(snapshots) >= 1)


if __name__ == "__main__":
    unittest.main()
