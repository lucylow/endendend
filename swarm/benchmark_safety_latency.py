#!/usr/bin/env python3
"""Run repeated SAFETY_STOP broadcasts and print latency stats (PYTHONPATH=. from repo root)."""

from __future__ import annotations

import argparse
import os
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import NetworkSimulator
from swarm.vertex_node import VertexNode


def main() -> None:
    p = argparse.ArgumentParser(description="Benchmark SAFETY_STOP edge latency")
    p.add_argument("--nodes", type=int, default=5)
    p.add_argument("--iterations", type=int, default=50)
    p.add_argument("--hop-ms", type=float, default=20.0, help="Emulator per-hop latency (ms)")
    args = p.parse_args()

    hop_s = args.hop_ms / 1000.0
    n = max(2, args.nodes)
    sim = NetworkSimulator()
    sim.set_default_open(False)
    ids = [f"d{i}" for i in range(n)]
    for a in ids:
        for b in ids:
            if a != b:
                sim.set_link(a, b, loss=0.0, latency=hop_s, status="up")

    net = NetworkEmulator(sim)
    vertices = [VertexNode(ids[k], net) for k in range(n)]
    origin = vertices[0]
    max_per_round: list[float] = []

    for _ in range(args.iterations):
        round_samples: list[float] = []

        def make_handler():
            def _h(_sender: str, msg: dict) -> None:
                if msg.get("type") != "SAFETY_STOP":
                    return
                wall = msg.get("_edge_sent_wall_s")
                if isinstance(wall, (int, float)):
                    round_samples.append((time.time() - float(wall)) * 1000.0)

            return _h

        h = make_handler()
        for v in vertices:
            v.set_message_handler(h)
        origin.send_safety({"reason": "benchmark"})
        if round_samples:
            max_per_round.append(max(round_samples))

    if not max_per_round:
        print("no samples")
        return
    print(
        f"nodes={n} hop_ms={args.hop_ms} iterations={args.iterations} "
        f"max_latency_ms max={max(max_per_round):.2f} mean={statistics.mean(max_per_round):.2f}"
    )


if __name__ == "__main__":
    main()
