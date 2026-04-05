#!/usr/bin/env python3
"""Headless scalability probe: N nodes on one emulator, gossip + sampled fan-out, CSV output.

Run from repo root::

    PYTHONPATH=. python swarm/run_scalability_test.py --sizes 10 20 50 --seconds 3

Uses :meth:`swarm.network_simulator.NetworkSimulator` edge counters (``stats``) plus
per-vertex :meth:`swarm.vertex_node.VertexNode.scalability_snapshot`.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from typing import Dict, List, Optional, Tuple

from swarm.network_emulator import NetworkEmulator
from swarm.network_simulator import NetworkSimulator
from swarm.vertex_node import VertexNode


def _edge_sends(sim: NetworkSimulator) -> int:
    with sim.lock:
        return sum(int(row.get("sent", 0)) for row in sim.stats.values())


def run_size(n: int, duration_sec: float, tick_sleep: float) -> Tuple[int, float, float]:
    sim = NetworkSimulator(mesh_id="scalability")
    net = NetworkEmulator(sim)
    verts: List[VertexNode] = []

    for i in range(n):
        nid = f"n{i:04d}"
        v = VertexNode(nid, net)
        verts.append(v)
        net.register(nid, lambda s, m, vv=v: vv.dispatch_incoming(s, m))

    t0 = time.time()
    edges0 = _edge_sends(sim)
    total_out0 = sum(v.messages_sent_total for v in verts)

    while time.time() - t0 < duration_sec:
        now = time.time()
        for v in verts:
            v.tick_peer_gossip(now)
            v.broadcast_sampled({"type": "SCAL_PROBE", "ts": now}, fanout=3)
        time.sleep(tick_sleep)

    elapsed = time.time() - t0
    edges1 = _edge_sends(sim)
    total_out1 = sum(v.messages_sent_total for v in verts)
    edge_delta = max(0, edges1 - edges0)
    vertex_delta = max(0, total_out1 - total_out0)
    return edge_delta, vertex_delta, elapsed


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Scalability messaging probe (no Webots).")
    p.add_argument("--sizes", type=int, nargs="+", default=[10, 20, 50], help="Swarm sizes to test")
    p.add_argument("--seconds", type=float, default=2.0, help="Duration per size")
    p.add_argument("--tick", type=float, default=0.05, help="Sleep between rounds")
    p.add_argument("--csv", type=str, default="", help="Write results CSV to this path")
    args = p.parse_args(argv)

    rows: List[Dict[str, object]] = []
    for n in args.sizes:
        if n < 2:
            print(f"skip n={n} (need >= 2)", file=sys.stderr)
            continue
        edge_delta, vertex_delta, elapsed = run_size(n, args.seconds, args.tick)
        per_node = (vertex_delta / n) / max(elapsed, 1e-9)
        rows.append(
            {
                "n": n,
                "duration_s": round(elapsed, 3),
                "emulator_edge_sends": edge_delta,
                "vertex_outbound_total": vertex_delta,
                "outbound_per_node_per_s": round(per_node, 3),
            }
        )
        print(
            f"n={n:4d}  edges={edge_delta:6d}  vertex_out={vertex_delta:6d}  "
            f"per_node_per_s={per_node:.2f}"
        )

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
            if rows:
                w.writeheader()
                w.writerows(rows)
        print(f"wrote {args.csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
