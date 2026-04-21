"""Publishes ``/swarm/relay_chain`` (``geometry_msgs/PoseArray``) from ``/swarm/global_state``."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseArray

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import SwarmGlobalState


class RelayChainNode(Node):
    def __init__(self) -> None:
        super().__init__('relay_chain_publisher')
        self.create_subscription(SwarmGlobalState, '/swarm/global_state', self._cb, CRITICAL_QOS)
        self._pub = self.create_publisher(PoseArray, '/swarm/relay_chain', CRITICAL_QOS)

    def _cb(self, msg: SwarmGlobalState) -> None:
        ordered = sorted(msg.drones, key=lambda d: self._idx(d.drone_id))
        out = PoseArray()
        out.header.stamp = msg.stamp
        out.header.frame_id = 'map'
        out.poses = [d.pose for d in ordered]
        self._pub.publish(out)

    @staticmethod
    def _idx(label: str) -> int:
        label = label.strip('/')
        if label.startswith('drone'):
            try:
                return int(label[5:])
            except ValueError:
                return 0
        return 0


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = RelayChainNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
