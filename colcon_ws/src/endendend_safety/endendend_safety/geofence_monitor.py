#!/usr/bin/env python3
"""Hard tunnel bounds from ``DroneState`` pose; debounced violation → E-stop signal."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from std_msgs.msg import Bool

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import DroneState


class GeofenceMonitor(Node):
    def __init__(self) -> None:
        super().__init__('geofence_monitor')
        self.declare_parameter('x_min', -80.0)
        self.declare_parameter('x_max', 80.0)
        self.declare_parameter('y_min', 0.0)
        self.declare_parameter('y_max', 40.0)
        self.declare_parameter('z_min', -5.0)
        self.declare_parameter('z_max', 120.0)
        self.declare_parameter('violation_threshold', 3)
        self._viol = 0
        self._thr = int(self.get_parameter('violation_threshold').value)
        self._pub = self.create_publisher(Bool, 'hardware/geofence_violation', 10)
        self.create_subscription(DroneState, 'state', self._cb, CRITICAL_QOS)

    def _cb(self, msg: DroneState) -> None:
        x, y, z = (
            float(msg.pose.position.x),
            float(msg.pose.position.y),
            float(msg.pose.position.z),
        )
        xm = (float(self.get_parameter('x_min').value), float(self.get_parameter('x_max').value))
        ym = (float(self.get_parameter('y_min').value), float(self.get_parameter('y_max').value))
        zm = (float(self.get_parameter('z_min').value), float(self.get_parameter('z_max').value))
        bad = not (xm[0] <= x <= xm[1] and ym[0] <= y <= ym[1] and zm[0] <= z <= zm[1])
        if bad:
            self._viol += 1
            if self._viol >= self._thr:
                self.get_logger().error(f'Geofence breach at ({x:.1f},{y:.1f},{z:.1f})')
                self._pub.publish(Bool(data=True))
                self._viol = 0
        else:
            self._viol = 0
            self._pub.publish(Bool(data=False))


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = GeofenceMonitor()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
