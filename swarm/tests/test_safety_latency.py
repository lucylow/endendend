"""Safety-stop propagation stays within edge-local budget (<100 ms) under the emulator."""

from __future__ import annotations

import time
import unittest

from swarm import config
from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import NetworkSimulator
from swarm.vertex_node import VertexNode


class TestSafetyLatency(unittest.TestCase):
    def test_safety_stop_wall_clock_under_100ms(self) -> None:
        n = 5
        hop_s = 0.025
        sim = NetworkSimulator()
        sim.set_default_open(False)
        for i in range(n):
            for j in range(n):
                if i != j:
                    a, b = f"d{i}", f"d{j}"
                    sim.set_link(a, b, loss=0.0, latency=hop_s, status="up")
        net = NetworkEmulator(sim)
        vertices = [VertexNode(f"d{k}", net) for k in range(n)]
        received: dict[str, float] = {}

        def make_handler(k: int):
            def _h(_sender: str, msg: dict) -> None:
                if msg.get("type") == "SAFETY_STOP":
                    wall = msg.get("_edge_sent_wall_s")
                    if isinstance(wall, (int, float)):
                        received[f"d{k}"] = (time.time() - float(wall)) * 1000.0

            return _h

        for k, v in enumerate(vertices):
            v.set_message_handler(make_handler(k))
            net.register(f"d{k}", v.dispatch_incoming)

        vertices[0].send_safety({"reason": "test"})

        self.assertEqual(len(received), n - 1, "every peer except sender should receive SAFETY_STOP")
        max_ms = max(received.values())
        self.assertLess(max_ms, 100.0, f"max edge latency {max_ms:.1f} ms should stay < 100 ms")

    def test_urgent_traffic_uses_reduced_simulated_hop_delay(self) -> None:
        sim = NetworkSimulator()
        sim.set_default_open(False)
        sim.set_link("a", "b", loss=0.0, latency=0.1, status="up")
        net = NetworkEmulator(sim)

        net.register("b", lambda _s, _m: None)

        t0 = time.monotonic()
        net.unicast("a", "b", {"type": "PING"})
        normal_dt = time.monotonic() - t0

        t1 = time.monotonic()
        net.unicast("a", "b", {"type": "PING", "priority": "high"})
        urgent_dt = time.monotonic() - t1

        scale = float(config.URGENT_LINK_LATENCY_SCALE)
        self.assertLess(urgent_dt, normal_dt * (scale + 0.15), "high-priority should sleep less per hop")


if __name__ == "__main__":
    unittest.main()
