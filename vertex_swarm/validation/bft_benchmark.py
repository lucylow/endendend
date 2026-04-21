"""Quick PBFT + mesh sanity checks (run: ``python -m vertex_swarm.validation.bft_benchmark``)."""

from __future__ import annotations

import os
import sys
import time

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from swarm.bft_pbft import PBFTCluster, RoundResult  # noqa: E402
from swarm.network_emulator import NetworkEmulator  # noqa: E402
from swarm.network_simulator import NetworkSimulator  # noqa: E402
from vertex_swarm.core.vertex_node import VertexSwarmNode  # noqa: E402


def main() -> None:
    os.environ.setdefault("VERTEX_SWARM_SECRET", "bench-secret-32bytes!!!!")
    os.environ.setdefault("VERTEX_FOXMQ_MOCK", "1")

    c = PBFTCluster(["a", "b", "c", "d"], byzantine_ids={"a"})
    out = c.run_consensus_round("relay-chain-v1")
    assert out.result == RoundResult.SUCCESS, out
    print("pbft_round_ok", out.global_seq, "view", out.view)

    sim = NetworkSimulator(mesh_id="bench")
    emu = NetworkEmulator(sim)
    ids = ["d0", "d1", "d2", "d3", "d4"]
    nodes: list[VertexSwarmNode] = []
    for nid in ids:
        n = VertexSwarmNode(nid, emulator=emu, network_sim=sim, mesh_routing=True)
        n.set_peer_roster(ids)
        emu.register(nid, n.vertex.dispatch_incoming)
        nodes.append(n)
    for n in nodes:
        n.start()
    t0 = time.perf_counter()
    r = nodes[0].leaderless_vote("GO", wait_s=0.6)
    dt_ms = (time.perf_counter() - t0) * 1000.0
    print("leaderless_vote_ms", round(dt_ms, 2), r)
    for n in nodes:
        n.shutdown()
    print("done")


if __name__ == "__main__":
    main()
