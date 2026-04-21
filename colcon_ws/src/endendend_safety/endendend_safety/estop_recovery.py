#!/usr/bin/env python3
"""Service to clear swarm / local safety latch (publish ``/swarm/safety_clear``)."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from std_msgs.msg import Bool
from std_srvs.srv import Trigger


class EStopRecovery(Node):
    def __init__(self) -> None:
        super().__init__('estop_recovery')
        self._clear_pub = self.create_publisher(Bool, '/swarm/safety_clear', 10)
        self._swarm_estop_pub = self.create_publisher(Bool, '/swarm/emergency_stop', 10)
        self.create_service(Trigger, 'safety_reset', self._reset_cb)
        self.get_logger().info('Service safety_reset (Trigger) ready.')

    def _reset_cb(self, _req: Trigger.Request, resp: Trigger.Response) -> Trigger.Response:
        self._clear_pub.publish(Bool(data=True))
        self._swarm_estop_pub.publish(Bool(data=False))
        resp.success = True
        resp.message = 'Published /swarm/safety_clear'
        return resp


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = EStopRecovery()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
