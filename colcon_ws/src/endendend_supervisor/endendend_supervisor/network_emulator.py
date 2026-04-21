"""Blackout tunnel metrics: publishes synthetic ``/supervisor/network_loss`` (0–1)."""

from __future__ import annotations

import math

import rclpy
from rclpy.node import Node
from std_msgs.msg import Float32


class NetworkEmulatorNode(Node):
    def __init__(self) -> None:
        super().__init__('network_emulator')
        self.declare_parameter('tunnel_length', 200.0)
        self.declare_parameter('network_loss_factor', 0.01)
        self.declare_parameter('failure_injection_rate', 0.05)
        self._tunnel = float(self.get_parameter('tunnel_length').value)
        self._base = float(self.get_parameter('network_loss_factor').value)
        self._fail = float(self.get_parameter('failure_injection_rate').value)
        self._pub = self.create_publisher(Float32, '/supervisor/network_loss', 10)
        self.create_timer(0.5, self._tick)

    def _tick(self) -> None:
        t = self.get_clock().now().nanoseconds * 1e-9
        depth = 0.5 + 0.5 * math.sin(t * 0.2)
        loss = min(1.0, self._base * depth * (self._tunnel / 200.0) + self._fail * abs(math.sin(t)))
        m = Float32()
        m.data = float(loss)
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
