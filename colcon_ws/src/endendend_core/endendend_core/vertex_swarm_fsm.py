"""Publishes ``yasmin_states`` (``std_msgs/String``) from ``DroneState.fsm_state`` for Track 2 / RViz."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from endendend_msgs.msg import DroneState


class VertexSwarmFsmNode(Node):
    def __init__(self) -> None:
        super().__init__('vertex_swarm_fsm')
        self.declare_parameter('heartbeat_interval', 2.0)
        self.declare_parameter('election_timeout', 5.0)
        self._last = 'BOOT'
        self._hb = max(0.2, float(self.get_parameter('heartbeat_interval').value))
        self._election_timeout = float(self.get_parameter('election_timeout').value)
        self._pub = self.create_publisher(String, 'yasmin_states', 10)
        self.create_subscription(DroneState, 'state', self._cb, 10)
        self.create_timer(self._hb, self._tick)
        self.get_logger().debug(f'election_timeout={self._election_timeout}s (reserved for future FSM hooks)')

    def _cb(self, msg: DroneState) -> None:
        self._last = msg.fsm_state

    def _tick(self) -> None:
        m = String()
        m.data = str(self._last)
        self._pub.publish(m)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = VertexSwarmFsmNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
