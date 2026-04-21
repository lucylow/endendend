#!/usr/bin/env python3
"""Battery + thermal limits from ``Float64MultiArray`` hardware topics."""

from __future__ import annotations

import math

import rclpy
from rclpy.node import Node
from std_msgs.msg import Bool, Float64MultiArray


class BMSMonitor(Node):
    def __init__(self) -> None:
        super().__init__('bms_monitor')
        self.declare_parameter('battery_crit_percent', 20.0)
        self.declare_parameter('temp_crit_c', 80.0)
        self._batt_crit = float(self.get_parameter('battery_crit_percent').value)
        self._temp_crit = float(self.get_parameter('temp_crit_c').value)
        self._rtl_pub = self.create_publisher(Bool, 'hardware/rtl_request', 10)
        self._thermal_pub = self.create_publisher(Bool, 'hardware/thermal_critical', 10)
        self.create_subscription(Float64MultiArray, 'hardware/battery_status', self._batt_cb, 5)
        self.create_subscription(Float64MultiArray, 'hardware/temperature', self._temp_cb, 5)

    def _batt_cb(self, msg: Float64MultiArray) -> None:
        if len(msg.data) < 3:
            return
        _v, _c, pct = float(msg.data[0]), float(msg.data[1]), float(msg.data[2])
        if pct < self._batt_crit:
            self.get_logger().warn(f'Low battery {pct:.1f}% → RTL request')
            self._rtl_pub.publish(Bool(data=True))

    def _temp_cb(self, msg: Float64MultiArray) -> None:
        if not msg.data:
            return
        mx = max(float(x) for x in msg.data if math.isfinite(x))
        if mx > self._temp_crit:
            self.get_logger().error(f'Thermal critical {mx:.1f}°C')
            self._thermal_pub.publish(Bool(data=True))


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = BMSMonitor()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
