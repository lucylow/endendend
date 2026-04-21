#!/usr/bin/env python3
"""Optional supervisor: prints mesh / Vertex env (metrics-only; no ROS master)."""

from __future__ import annotations

import json
import os
import sys


def main() -> None:
    info = {
        "TASHI_VERTEX_SWARM": os.environ.get("TASHI_VERTEX_SWARM"),
        "VERTEX_SWARM_SECRET_set": bool(os.environ.get("VERTEX_SWARM_SECRET")),
        "FOXMQ_BROKERS": os.environ.get("FOXMQ_BROKERS", "127.0.0.1"),
        "VERTEX_FOXMQ_MOCK": os.environ.get("VERTEX_FOXMQ_MOCK"),
        "VERTEX_VOTE_ECHO": os.environ.get("VERTEX_VOTE_ECHO"),
    }
    print(json.dumps({"vertex_supervisor": info}, indent=2))


if __name__ == "__main__":
    main()
