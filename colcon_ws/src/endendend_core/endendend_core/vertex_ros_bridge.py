"""ROS 2 bridge stub for Vertex / FoxMQ style fan-out (JSON over ``std_msgs/String``)."""

from __future__ import annotations

import json
import os

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from endendend_core.qos_profiles import SWARM_QOS
from endendend_msgs.msg import SwarmGlobalState


class VertexRosBridge(Node):
    """Bidirectional stub: swarm global state -> vertex topics; optional FoxMQ-style ports as params."""

    def __init__(self) -> None:
        super().__init__('vertex_ros_bridge')
        self.declare_parameter('foxmq_broker_port', 1883)
        self.declare_parameter('vertex_discovery_port', 5353)
        self.declare_parameter('swarm_domain_id', int(os.environ.get('ROS_DOMAIN_ID', '0')))
        self._fox = int(self.get_parameter('foxmq_broker_port').value)
        self._disc = int(self.get_parameter('vertex_discovery_port').value)
        self._dom = int(self.get_parameter('swarm_domain_id').value)
        self.get_logger().info(
            f'Bridge params foxmq={self._fox} discovery={self._disc} swarm_domain_id={self._dom} (stub)'
        )

        self._state_sub = self.create_subscription(
            SwarmGlobalState,
            '/swarm/global_state',
            self._state_cb,
            SWARM_QOS,
        )
        self._vertex_out = self.create_publisher(String, '/vertex/broadcast', 10)
        self._swarm_vertex = self.create_publisher(String, '/swarm/vertex_broadcast', 10)
        self._ros_out = self.create_publisher(String, '/vertex/ingress', 10)
        self._vertex_in = self.create_subscription(
            String,
            '/vertex/commands',
            self._vertex_cb,
            10,
        )
        self.get_logger().info('VertexRosBridge active (JSON encoding + /swarm/vertex_broadcast).')

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
        self._swarm_vertex.publish(out)

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
