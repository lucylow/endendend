"""Vertex + FoxMQ swarm coordination package (leaderless mesh; no ROS master).

This package composes the existing ``swarm`` runtime (Vertex P2P, FoxMQ MQTT,
PBFT helpers) behind a Track-2-friendly API. ROS 2 stacks under ``colcon_ws/``
remain optional for vision bring-up; controllers launched via
``webots/controllers/drone_vertex.py`` default to ROS-free coordination.
"""

from __future__ import annotations

from vertex_swarm.core.vertex_node import VertexSwarmNode

__all__ = ["VertexSwarmNode", "__version__"]
__version__ = "0.1.0"
