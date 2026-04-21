#!/usr/bin/env python3
"""Dispersion / sector pattern: react to inactive drones and publish sector role hints."""

from __future__ import annotations

import json

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import Int32MultiArray, String


class SectorReallocBehavior(Node):
    def __init__(self) -> None:
        super().__init__('sector_realloc_behavior')
        self.declare_parameter('num_drones', 5)
        self._num = int(self.get_parameter('num_drones').value)
        qos = QoSProfile(
            depth=1,
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
        )
        self.create_subscription(Int32MultiArray, '/supervisor/inactive_drone_ids', self._inactive_cb, qos)
        self._pub = self.create_publisher(String, '/swarm/sector_roles', 10)
        self._inactive: set[int] = set()
        self.create_timer(1.0, self._tick)

    def _inactive_cb(self, msg: Int32MultiArray) -> None:
        self._inactive = set(int(x) for x in msg.data)

    def _tick(self) -> None:
        sectors = []
        for i in range(self._num):
            if i in self._inactive:
                continue
            sectors.append({'drone': i, 'sector': (i * 72) % 360})
        m = String()
        m.data = json.dumps({'pattern': 'sector_dispersion', 'assignments': sectors})
        self._pub.publish(m)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = SectorReallocBehavior()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
