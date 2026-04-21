"""Smoke tests for ``vertex_swarm`` package (in-process mesh)."""

from __future__ import annotations

import os

from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import NetworkSimulator
from vertex_swarm.core.vertex_node import VertexSwarmNode


def test_leaderless_vote_reaches_quorum() -> None:
    os.environ["VERTEX_SWARM_SECRET"] = "unit-test-secret-32bytes!!!"
    os.environ["VERTEX_FOXMQ_MOCK"] = "1"
    sim = NetworkSimulator(mesh_id="tvs")
    emu = NetworkEmulator(sim)
    ids = ["a", "b", "c", "d"]
    nodes: list[VertexSwarmNode] = []
    for nid in ids:
        n = VertexSwarmNode(nid, emulator=emu, network_sim=sim, mesh_routing=True)
        n.set_peer_roster(ids)
        emu.register(nid, n.vertex.dispatch_incoming)
        nodes.append(n)
    for n in nodes:
        n.start()
    try:
        out = nodes[0].leaderless_vote("ACK", wait_s=0.8)
        assert out.get("decided") is True
        assert out.get("choice") == "ACK"
    finally:
        for n in nodes:
            n.shutdown()


def test_signed_state_merge() -> None:
    os.environ["VERTEX_SWARM_SECRET"] = "unit-test-secret-32bytes!!!"
    os.environ["VERTEX_FOXMQ_MOCK"] = "1"
    sim = NetworkSimulator(mesh_id="tvs2")
    emu = NetworkEmulator(sim)
    n1 = VertexSwarmNode("x", emulator=emu, network_sim=sim, mesh_routing=True)
    n2 = VertexSwarmNode("y", emulator=emu, network_sim=sim, mesh_routing=True)
    for nid, n in [("x", n1), ("y", n2)]:
        n.set_peer_roster(["x", "y"])
        emu.register(nid, n.vertex.dispatch_incoming)
    n1.start()
    n2.start()
    try:
        n1.submit_event("state/roles", "x", "explorer", op="role")
        assert n2.state.roles.get("x") == "explorer"
    finally:
        n1.shutdown()
        n2.shutdown()
