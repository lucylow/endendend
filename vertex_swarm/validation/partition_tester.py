"""Directed link partitions using ``NetworkSimulator`` (heal + re-run)."""

from __future__ import annotations

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from swarm.network_emulator import NetworkEmulator  # noqa: E402
from swarm.network_simulator import NetworkSimulator  # noqa: E402
from vertex_swarm.core.vertex_node import VertexSwarmNode  # noqa: E402


def main() -> None:
    os.environ.setdefault("VERTEX_SWARM_SECRET", "partition-test-secret-32b!")
    os.environ.setdefault("VERTEX_FOXMQ_MOCK", "1")

    sim = NetworkSimulator(mesh_id="partition")
    emu = NetworkEmulator(sim)
    ids = ["east_a", "east_b", "west_c"]
    nodes = []
    for nid in ids:
        n = VertexSwarmNode(nid, emulator=emu, network_sim=sim, mesh_routing=True)
        n.set_peer_roster(ids)
        emu.register(nid, n.vertex.dispatch_incoming)
        nodes.append(n)
    for n in nodes:
        n.start()

    # Partition: east cluster cannot reach west
    sim.set_link("east_a", "west_c", loss=1.0, status="down", asymmetric=True)
    sim.set_link("east_b", "west_c", loss=1.0, status="down", asymmetric=True)
    sim.set_link("west_c", "east_a", loss=1.0, status="down", asymmetric=True)
    sim.set_link("west_c", "east_b", loss=1.0, status="down", asymmetric=True)

    r_part = nodes[0].leaderless_vote("SPLIT", wait_s=0.25)
    print("while_partition", r_part)

    # Heal
    sim.set_link_bidirectional("east_a", "west_c", loss_ab=0.0)
    sim.set_link_bidirectional("east_b", "west_c", loss_ab=0.0)

    r_ok = nodes[0].leaderless_vote("MERGED", wait_s=0.5)
    print("after_heal", r_ok)
    for n in nodes:
        n.shutdown()


if __name__ == "__main__":
    main()
