#!/usr/bin/env python3
"""Simulated battery + motor temps for bench / Webots (namespaced hardware/*)."""

from __future__ import annotations

import random

import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64MultiArray


class HardwareMock(Node):
    def __init__(self) -> None:
        super().__init__('hardware_mock')
        self._pct = 100.0
        self._temps = [40.0, 42.0, 38.0, 45.0]
        self._batt_pub = self.create_publisher(Float64MultiArray, 'hardware/battery_status', 10)
        self._temp_pub = self.create_publisher(Float64MultiArray, 'hardware/temperature', 10)
        self.create_timer(1.0, self._tick)

    def _tick(self) -> None:
        self._pct = max(5.0, self._pct - 0.08)
        self._temps = [t + random.gauss(0.0, 0.4) for t in self._temps]
        b = Float64MultiArray()
        b.data = [12.6, -3.5, self._pct]
        self._batt_pub.publish(b)
        t = Float64MultiArray()
        t.data = self._temps
        self._temp_pub.publish(t)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = HardwareMock()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
