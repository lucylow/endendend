#!/usr/bin/env python3
"""IR / Lidar reactive layer: proximity alert + optional repel twist."""

from __future__ import annotations

import math

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan
from std_msgs.msg import Bool


class CollisionAvoid(Node):
    def __init__(self) -> None:
        super().__init__('collision_avoid')
        self.declare_parameter('min_range_m', 1.0)
        self.declare_parameter('repel_gain', 2.0)
        self.declare_parameter('enable_lidar', False)
        self._min_r = float(self.get_parameter('min_range_m').value)
        self._gain = float(self.get_parameter('repel_gain').value)
        self._alert_pub = self.create_publisher(Bool, 'hardware/proximity_alert', 10)
        self._repel_pub = self.create_publisher(Twist, 'safety/repel_twist', 10)
        if bool(self.get_parameter('enable_lidar').value):
            self.create_subscription(LaserScan, 'scan', self._scan_cb, 10)

    def _scan_cb(self, msg: LaserScan) -> None:
        ranges = [
            float(r)
            for r in msg.ranges
            if math.isfinite(r) and msg.range_min < r < msg.range_max
        ]
        if not ranges:
            self._alert_pub.publish(Bool(data=False))
            self._repel_pub.publish(Twist())
            return
        mn = min(ranges)
        alert = mn < self._min_r
        self._alert_pub.publish(Bool(data=alert))
        tw = Twist()
        if alert:
            scale = self._gain * max(0.0, (self._min_r - mn) / self._min_r)
            tw.linear.x = -scale
        self._repel_pub.publish(tw)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = CollisionAvoid()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
