#!/usr/bin/env python3
"""Mux + stall detection: ``cmd_vel_raw`` → ``cmd_vel``; swarm E-stop; status topics."""

from __future__ import annotations

import time

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import Bool

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import DroneState


class SafetyWatchdog(Node):
    def __init__(self) -> None:
        super().__init__('safety_watchdog')
        self.declare_parameter('state_stall_timeout_s', 0.25)
        self.declare_parameter('control_rate_hz', 20.0)
        self._stall = float(self.get_parameter('state_stall_timeout_s').value)
        self._last_state_rx = time.monotonic()
        self._estop = False
        self._swarm_estop = False
        self._repel = Twist()
        self._last_raw = Twist()

        self.create_subscription(DroneState, 'state', self._state_cb, CRITICAL_QOS)
        self.create_subscription(Twist, 'cmd_vel_raw', self._raw_cb, 10)
        self.create_subscription(Bool, '/swarm/emergency_stop', self._swarm_estop_cb, 10)
        self.create_subscription(Bool, '/swarm/safety_clear', self._clear_cb, 10)
        self.create_subscription(Bool, 'hardware/proximity_alert', self._prox_cb, 10)
        self.create_subscription(Twist, 'safety/repel_twist', self._repel_cb, 10)

        self._estop_pub = self.create_publisher(Bool, 'hardware/estop_active', 10)
        self._geofence_sub = self.create_subscription(Bool, 'hardware/geofence_violation', self._gf_cb, 10)
        self._bms_sub = self.create_subscription(Bool, 'hardware/thermal_critical', self._therm_cb, 10)

        self._cmd_pub = self.create_publisher(Twist, 'cmd_vel', 10)
        period = 1.0 / max(1.0, float(self.get_parameter('control_rate_hz').value))
        self.create_timer(period, self._tick)
        self.get_logger().info('Safety watchdog armed (cmd_vel_raw → cmd_vel).')

    def _state_cb(self, _msg: DroneState) -> None:
        self._last_state_rx = time.monotonic()

    def _raw_cb(self, msg: Twist) -> None:
        self._last_raw = msg

    def _swarm_estop_cb(self, msg: Bool) -> None:
        if msg.data:
            self._swarm_estop = True
            self._activate('swarm emergency_stop')

    def _clear_cb(self, msg: Bool) -> None:
        if msg.data:
            self._estop = False
            self._swarm_estop = False
            self.get_logger().info('Safety clear received; releasing local E-stop latch.')

    def _gf_cb(self, msg: Bool) -> None:
        if msg.data:
            self._activate('geofence violation')

    def _therm_cb(self, msg: Bool) -> None:
        if msg.data:
            self._activate('thermal critical')

    def _prox_cb(self, msg: Bool) -> None:
        if msg.data:
            self._repel.linear.x = -0.5
        else:
            self._repel = Twist()

    def _repel_cb(self, msg: Twist) -> None:
        self._repel = msg

    def _activate(self, reason: str) -> None:
        if not self._estop:
            self.get_logger().error(f'E-STOP: {reason}')
        self._estop = True

    def _tick(self) -> None:
        stalled = (time.monotonic() - self._last_state_rx) > self._stall
        if stalled:
            self._activate('controller / state stall')

        active = self._estop or self._swarm_estop
        est = Bool()
        est.data = bool(active)
        self._estop_pub.publish(est)

        out = Twist()
        if not active:
            out.linear.x = self._last_raw.linear.x + self._repel.linear.x
            out.linear.y = self._last_raw.linear.y + self._repel.linear.y
            out.linear.z = self._last_raw.linear.z + self._repel.linear.z
            out.angular = self._last_raw.angular
        self._cmd_pub.publish(out)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = SafetyWatchdog()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
