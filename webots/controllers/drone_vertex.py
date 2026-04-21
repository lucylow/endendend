#!/usr/bin/env python3
"""Webots drone entry: Vertex/FoxMQ coordination path (no ``rclpy``).

Sets ``TASHI_VERTEX_SWARM=1`` and disables ROS2 vision by default so judges can
run a pure mesh stack. Uses the same ``DroneController`` harness as
``swarm_controller``; wire ``VERTEX_SWARM_SECRET`` identically on every agent for
signed state verification across processes.
"""

from __future__ import annotations

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

os.environ.setdefault("TASHI_VERTEX_SWARM", "1")
os.environ.setdefault("TASHI_ROS2_VISION", "0")
os.environ.setdefault("VERTEX_FOXMQ_MOCK", "1")

from swarm.webots_controller import launch_controller  # noqa: E402


def main() -> None:
    launch_controller().run()


if __name__ == "__main__":
    main()
