#!/usr/bin/env python3
"""Fan-in local E-stops → ``/swarm/emergency_stop`` + JSON stub on ``/vertex/broadcast``."""

from __future__ import annotations

import json
import time

import rclpy
from rclpy.node import Node
from std_msgs.msg import Bool, String


class SwarmSafety(Node):
    def __init__(self) -> None:
        super().__init__('swarm_safety')
        self.declare_parameter('num_drones', 5)
        self._n = int(self.get_parameter('num_drones').value)
        self._swarm_pub = self.create_publisher(Bool, '/swarm/emergency_stop', 10)
        self._vertex_pub = self.create_publisher(String, '/vertex/broadcast', 10)
        self._locals: dict[int, bool] = {}
        for i in range(self._n):

            def _cb(msg: Bool, idx: int = i) -> None:
                self._locals[idx] = bool(msg.data)
                if msg.data:
                    self._broadcast(idx)

            self.create_subscription(Bool, f'/drone{i}/hardware/estop_active', _cb, 10)

    def _broadcast(self, source_idx: int) -> None:
        self._swarm_pub.publish(Bool(data=True))
        payload = {
            'channel': 'emergency_stop',
            'source': f'drone{source_idx}',
            'timestamp': time.time(),
            'reason': 'local_hardware_estop',
        }
        m = String()
        m.data = json.dumps(payload)
        self._vertex_pub.publish(m)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = SwarmSafety()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
