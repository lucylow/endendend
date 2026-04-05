"""Multi-hop mesh routing (distance vector) and flood (PYTHONPATH=. python -m unittest swarm.tests.test_mesh_routing)."""

from __future__ import annotations

import unittest

from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import NetworkSimulator
from swarm.vertex_node import ROUTING_PERIOD_SEC, VertexNode


class TestMeshRouting(unittest.TestCase):
    def _line_topology(self, ids: list[str]) -> NetworkSimulator:
        sim = NetworkSimulator("line")
        sim.set_default_open(False)
        for i in range(len(ids) - 1):
            sim.set_link_bidirectional(ids[i], ids[i + 1], loss_ab=0.0, latency_ab=0.0)
        return sim

    def _build_mesh(self, sim: NetworkSimulator, ids: list[str]) -> list[VertexNode]:
        net = NetworkEmulator(sim)
        nodes: list[VertexNode] = []
        for nid in ids:
            v = VertexNode(nid, emulator=net, mesh_routing=True, network_sim=sim)
            nodes.append(v)
        for v in nodes:
            net.register(v.node_id, v.dispatch_incoming)
        return nodes

    def test_convergence_line_unicast(self) -> None:
        ids = ["n1", "n2", "n3", "n4", "n5"]
        sim = self._line_topology(ids)
        nodes = self._build_mesh(sim, ids)
        got: list[tuple[str, dict]] = []

        def app_for(nid: str):
            def _app(sender: str, msg: dict) -> None:
                if nid == "n5" and msg.get("type") == "PROBE":
                    got.append((sender, msg))

            return _app

        for v, nid in zip(nodes, ids):
            v.set_message_handler(app_for(nid))

        t = 0.0
        for _ in range(40):
            t += ROUTING_PERIOD_SEC + 0.1
            for v in nodes:
                v.tick_mesh(t)

        best = nodes[0].routing.get_best("n5")
        self.assertIsNotNone(best)
        self.assertEqual(best[0], "n2")
        self.assertEqual(best[1], 4)

        self.assertTrue(nodes[0].send_to("n5", {"type": "PROBE", "v": 1}))
        self.assertEqual(len(got), 1)
        self.assertEqual(got[0][0], "n1")
        self.assertEqual(got[0][1].get("v"), 1)

    def test_flood_reaches_end_of_line(self) -> None:
        ids = ["a", "b", "c", "d"]
        sim = self._line_topology(ids)
        nodes = self._build_mesh(sim, ids)
        seen: dict[str, int] = {}

        def app_for(nid: str):
            def _app(sender: str, msg: dict) -> None:
                if msg.get("type") == "WAVE":
                    seen[nid] = seen.get(nid, 0) + 1

            return _app

        for v, nid in zip(nodes, ids):
            v.set_message_handler(app_for(nid))

        t = 0.0
        for _ in range(30):
            t += ROUTING_PERIOD_SEC + 0.1
            for v in nodes:
                v.tick_mesh(t)

        nodes[0].mesh_flood({"type": "WAVE"}, ttl=8)
        self.assertEqual(seen.get("d", 0), 1)
        # Origin does not deliver to itself on flood; relay nodes do.
        self.assertEqual(len(seen), 3)

    def test_mesh_snapshot_has_logical_mesh(self) -> None:
        sim = NetworkSimulator("snap")
        sim.set_default_open(True)
        net = NetworkEmulator(sim)
        v = VertexNode("x", emulator=net, mesh_routing=True, network_sim=sim)
        net.register("x", v.dispatch_incoming)
        net.register("y", lambda _s, _m: None)
        v.set_message_handler(lambda _s, _m: None)
        v.tick_mesh(10.0)
        snap = sim.get_mesh_snapshot()
        self.assertIn("logical_mesh", snap)
        self.assertIn("x", snap["logical_mesh"])

    def test_neighbor_drops_remove_routes(self) -> None:
        ids = ["p", "q", "r"]
        sim = NetworkSimulator()
        sim.set_default_open(False)
        sim.set_link_bidirectional("p", "q", loss_ab=0.0, latency_ab=0.0)
        sim.set_link_bidirectional("q", "r", loss_ab=0.0, latency_ab=0.0)
        nodes = self._build_mesh(sim, ids)
        for v in nodes:
            v.set_message_handler(lambda _s, _m: None)

        t = 0.0
        for _ in range(25):
            t += ROUTING_PERIOD_SEC + 0.1
            for v in nodes:
                v.tick_mesh(t)

        self.assertIsNotNone(nodes[0].routing.get_best("r"))

        sim.set_link("p", "q", loss=1.0, latency=0.0, status="up", asymmetric=True)
        sim.set_link("q", "p", loss=1.0, latency=0.0, status="up", asymmetric=True)

        t += ROUTING_PERIOD_SEC + 0.1
        for v in nodes:
            v.tick_mesh(t)

        self.assertEqual(nodes[0].neighbors & {"q"}, set())
        self.assertIsNone(nodes[0].routing.get_best("r"))


if __name__ == "__main__":
    unittest.main()
