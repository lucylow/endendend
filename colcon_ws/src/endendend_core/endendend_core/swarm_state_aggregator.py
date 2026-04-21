"""Subscribe per-drone ``state`` + supervisor inactive list; publish ``/swarm/global_state``."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import Int32MultiArray

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import DroneState, SwarmGlobalState


class SwarmStateAggregator(Node):
    def __init__(self) -> None:
        super().__init__('swarm_state_aggregator')
        self.declare_parameter('num_drones', 5)
        self.declare_parameter('state_topic', 'state')
        self._num = int(self.get_parameter('num_drones').value)
        self._state_topic = str(self.get_parameter('state_topic').value)
        self._latest: dict[str, DroneState] = {}
        self._inactive: set[int] = set()
        self._subs = []
        for i in range(self._num):
            ns = f'/drone{i}'
            topic = f'{ns}/{self._state_topic}'
            self._subs.append(
                self.create_subscription(
                    DroneState,
                    topic,
                    self._make_cb(ns),
                    CRITICAL_QOS,
                )
            )
        inactive_qos = QoSProfile(
            depth=1,
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
        )
        self.create_subscription(Int32MultiArray, '/supervisor/inactive_drone_ids', self._inactive_cb, inactive_qos)
        self._pub = self.create_publisher(SwarmGlobalState, '/swarm/global_state', CRITICAL_QOS)
        self.create_timer(0.1, self._tick)
        self.get_logger().info(f'Aggregating {self._num} drones -> /swarm/global_state')

    def _make_cb(self, ns: str):
        def _cb(msg: DroneState) -> None:
            self._latest[ns] = msg

        return _cb

    def _inactive_cb(self, msg: Int32MultiArray) -> None:
        self._inactive = set(int(x) for x in msg.data)

    def _tick(self) -> None:
        msg = SwarmGlobalState()
        msg.stamp = self.get_clock().now().to_msg()
        drones: list[DroneState] = []
        for i in range(self._num):
            if i in self._inactive:
                continue
            st = self._latest.get(f'/drone{i}')
            if st is not None:
                drones.append(st)
        msg.drones = drones
        self._pub.publish(msg)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = SwarmStateAggregator()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
