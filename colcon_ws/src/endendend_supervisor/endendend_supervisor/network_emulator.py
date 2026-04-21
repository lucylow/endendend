"""Depth-style network emulation for Vertex P2P (Track 2 blackout tunnel).

Publishes ``std_msgs/Float64MultiArray`` on ``/supervisor/network_loss`` with ``[loss01, latency_ms]`` where
``loss01`` is in ``[0, 1]``. When ``/swarm/global_state`` is unavailable (no aggregator yet), falls back to a
deterministic synthetic profile so CI / bring-up still produces traffic.

Subscribes to ``/supervisor/loss_spike`` (``std_msgs/Float64``) — emitted by the Webots ``supervisor_controller`` on
``inject_loss`` — and applies a short boost to the published loss.
"""

from __future__ import annotations

import math
import time
from typing import Optional

import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64, Float64MultiArray

from endendend_msgs.msg import SwarmGlobalState


def _depth_metric_from_state(msg: SwarmGlobalState) -> float:
    """Larger when the fleet is deeper into the tunnel volume (XZ extent from origin)."""
    if not msg.drones:
        return 0.0
    s = 0.0
    n = 0
    for st in msg.drones:
        p = st.pose.position
        s += math.hypot(float(p.x), float(p.z))
        n += 1
    return s / max(1, n)


class NetworkEmulatorNode(Node):
    def __init__(self) -> None:
        super().__init__('network_emulator')
        self.declare_parameter('tunnel_length', 200.0)
        self.declare_parameter('network_loss_factor', 1.0)
        self.declare_parameter('failure_injection_rate', 0.02)
        self.declare_parameter('latency_ms_per_depth', 0.35)
        self.declare_parameter('max_loss', 0.85)
        self.declare_parameter('spike_decay_sec', 4.0)
        self._tunnel = max(10.0, float(self.get_parameter('tunnel_length').value))
        self._scale = float(self.get_parameter('network_loss_factor').value)
        self._jitter = float(self.get_parameter('failure_injection_rate').value)
        self._lat_scale = float(self.get_parameter('latency_ms_per_depth').value)
        self._max_loss = float(self.get_parameter('max_loss').value)
        self._spike_decay = max(0.5, float(self.get_parameter('spike_decay_sec').value))

        self._last_state: Optional[SwarmGlobalState] = None
        self._spike_value = 0.0
        self._spike_until = 0.0

        self._pub = self.create_publisher(Float64MultiArray, '/supervisor/network_loss', 10)
        self.create_subscription(SwarmGlobalState, '/swarm/global_state', self._state_cb, 10)
        self.create_subscription(Float64, '/supervisor/loss_spike', self._spike_cb, 10)
        self.create_timer(0.1, self._tick)

    def _state_cb(self, msg: SwarmGlobalState) -> None:
        self._last_state = msg

    def _spike_cb(self, msg: Float64) -> None:
        self._spike_value = max(self._spike_value, float(abs(msg.data)))
        self._spike_until = time.monotonic() + self._spike_decay

    def _tick(self) -> None:
        now = time.monotonic()
        t = self.get_clock().now().nanoseconds * 1e-9
        depth = _depth_metric_from_state(self._last_state) if self._last_state else 0.0
        if self._last_state is None:
            depth = 0.5 + 0.5 * math.sin(t * 0.15)

        depth_loss = min(self._max_loss, (depth / self._tunnel) * 0.8 * self._scale)
        jitter = self._jitter * abs(math.sin(t * 0.7))
        spike = self._spike_value if now < self._spike_until else 0.0
        if now >= self._spike_until:
            self._spike_value = 0.0

        loss01 = float(min(0.99, depth_loss + jitter + spike))
        latency_ms = float(min(500.0, depth * self._lat_scale + 5.0 * jitter))

        m = Float64MultiArray()
        m.data = [loss01, latency_ms]
        self._pub.publish(m)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = NetworkEmulatorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
