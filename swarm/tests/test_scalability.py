"""Scalability helpers: sampled fan-out."""

from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import NetworkSimulator
from swarm.vertex_node import VertexNode


def test_fanout_sample_delivers_subset() -> None:
    sim = NetworkSimulator()
    net = NetworkEmulator(sim)
    received: dict[str, list] = {f"n{i}": [] for i in range(6)}

    for i in range(6):
        nid = f"n{i}"

        def make_cb(k: str):
            def cb(sender: str, msg: dict) -> None:
                received[k].append((sender, msg.get("type")))

            return cb

        net.register(nid, make_cb(nid))

    origin = VertexNode("n0", net)
    origin.broadcast_sampled({"type": "PROBE"}, fanout=2)
    total = sum(len(v) for v in received.values())
    assert total == 2
    assert len(received["n0"]) == 0
