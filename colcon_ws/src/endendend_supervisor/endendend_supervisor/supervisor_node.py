"""Failure injection + Vertex election (reads ``/swarm/global_state`` from aggregator)."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import Int32MultiArray

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import SwarmGlobalState
from endendend_msgs.srv import KillDrone, VertexElection


class FailureInjectorNode(Node):
    def __init__(self) -> None:
        super().__init__('failure_injector')
        self.declare_parameter('num_drones', 5)
        self._num = int(self.get_parameter('num_drones').value)
        self._last: SwarmGlobalState | None = None
        self._killed: set[int] = set()
        self.create_subscription(SwarmGlobalState, '/swarm/global_state', self._state_cb, CRITICAL_QOS)
        inactive_qos = QoSProfile(
            depth=1,
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
        )
        self._inactive_pub = self.create_publisher(Int32MultiArray, '/supervisor/inactive_drone_ids', inactive_qos)
        self._kill_srv = self.create_service(KillDrone, '/supervisor/kill_drone', self._kill_cb)
        self._election_srv = self.create_service(VertexElection, '/vertex/election', self._election_cb)
        self._publish_inactive()
        self.get_logger().info('Failure injector + election services ready.')

    def _state_cb(self, msg: SwarmGlobalState) -> None:
        self._last = msg

    def _publish_inactive(self) -> None:
        m = Int32MultiArray()
        m.data = sorted(self._killed)
        self._inactive_pub.publish(m)

    def _kill_cb(self, request: KillDrone.Request, response: KillDrone.Response) -> KillDrone.Response:
        if request.drone_id < 0 or request.drone_id >= self._num:
            response.success = False
            response.message = 'drone_id out of range'
            return response
        self._killed.add(int(request.drone_id))
        self._publish_inactive()
        response.success = True
        response.message = f'drone {request.drone_id} marked inactive'
        return response

    def _election_cb(
        self, request: VertexElection.Request, response: VertexElection.Response
    ) -> VertexElection.Response:
        if self._last is None or not self._last.drones:
            leader_id = 'drone0'
        else:
            best_id = None
            best_z = float('inf')
            for st in self._last.drones:
                idx = self._drone_index(st.drone_id)
                if idx is None or idx in self._killed:
                    continue
                z = st.pose.position.z
                if z < best_z:
                    best_z = z
                    best_id = st.drone_id
            leader_id = best_id or self._last.drones[0].drone_id
        response.is_leader = request.drone_id == leader_id
        response.role = 'elected' if response.is_leader else 'backup'
        return response

    @staticmethod
    def _drone_index(label: str) -> int | None:
        label = label.strip('/')
        if not label.startswith('drone'):
            return None
        try:
            return int(label.replace('drone', '', 1))
        except ValueError:
            return None


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = FailureInjectorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
