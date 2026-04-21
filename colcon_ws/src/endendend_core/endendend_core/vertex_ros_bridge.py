"""ROS 2 bridge stub for Vertex / FoxMQ style fan-out (JSON over std_msgs/String)."""

from __future__ import annotations

import json

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from endendend_core.qos_profiles import SWARM_QOS
from endendend_msgs.msg import SwarmGlobalState


class VertexRosBridge(Node):
    """Bidirectional stub: swarm global state -> vertex topic; inject RX for demos."""

    def __init__(self) -> None:
        super().__init__('vertex_ros_bridge')
        self._state_sub = self.create_subscription(
            SwarmGlobalState,
            '/swarm/global_state',
            self._state_cb,
            SWARM_QOS,
        )
        self._vertex_out = self.create_publisher(String, '/vertex/broadcast', 10)
        self._ros_out = self.create_publisher(String, '/vertex/ingress', 10)
        self._vertex_in = self.create_subscription(
            String,
            '/vertex/commands',
            self._vertex_cb,
            10,
        )
        self.get_logger().info('VertexRosBridge active (stub JSON encoding).')

    def _state_cb(self, msg: SwarmGlobalState) -> None:
        payload = {
            'stamp': {'sec': msg.stamp.sec, 'nanosec': msg.stamp.nanosec},
            'drones': [
                {
                    'id': d.drone_id,
                    'fsm': d.fsm_state,
                    'battery': d.battery,
                }
                for d in msg.drones
            ],
        }
        out = String()
        out.data = json.dumps({'channel': 'swarm_state', 'payload': payload})
        self._vertex_out.publish(out)

    def _vertex_cb(self, msg: String) -> None:
        self._ros_out.publish(msg)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = VertexRosBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
