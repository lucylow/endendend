"""Namespaced drone node: state publish, heartbeat, cmd_vel, YASMIN worker thread."""

from __future__ import annotations

import math
import os

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Pose, Twist

from endendend_core.qos_profiles import CRITICAL_QOS, HEARTBEAT_QOS
from endendend_core.yasmin_swarm_fsm import create_swarm_fsm, start_fsm_thread
from endendend_msgs.msg import DroneState, Heartbeat
from yasmin import Blackboard


class DroneController(Node):
    def __init__(self) -> None:
        super().__init__('drone_controller')
        self.declare_parameter('drone_id', 0)
        self.declare_parameter('initial_depth', 0.0)
        self.declare_parameter('fsm_tick_s', 0.5)
        self.declare_parameter('swarm_leader_depth', 0.0)
        self.declare_parameter('vertex_peer_port', 19790)
        self.declare_parameter('sim_mode', False)
        self.declare_parameter('ros_domain_id', 0)
        self.declare_parameter('enable_yasmin_thread', True)

        drone_id = int(self.get_parameter('drone_id').value)
        self._depth = float(self.get_parameter('initial_depth').value)
        self._drone_id = drone_id
        ns = self.get_namespace() or ''
        self._drone_label = ns.strip('/') or f'drone{drone_id}'

        self._bb = Blackboard()
        self._bb['peer_count'] = 0
        self._bb['depth'] = self._depth
        self._bb['leader_depth'] = float(self.get_parameter('swarm_leader_depth').value)
        self._bb['fsm_tick_s'] = float(self.get_parameter('fsm_tick_s').value)
        self._bb['election_role'] = 'elected' if self._depth <= self._bb['leader_depth'] else 'backup'

        self._peer_ids: set[str] = set()
        self._sim_mode = bool(self.get_parameter('sim_mode').value)
        self._p2p_port = int(self.get_parameter('vertex_peer_port').value)
        _dom = os.environ.get('ROS_DOMAIN_ID', str(int(self.get_parameter('ros_domain_id').value)))
        self.get_logger().debug(f'ROS_DOMAIN_ID={_dom}')

        self._cmd_vel_pub = self.create_publisher(Twist, 'cmd_vel', 10)
        self._state_pub = self.create_publisher(DroneState, 'state', CRITICAL_QOS)
        self._heartbeat_pub = self.create_publisher(Heartbeat, '/swarm/heartbeat', HEARTBEAT_QOS)
        self.create_subscription(
            Heartbeat,
            '/swarm/heartbeat',
            self._heartbeat_cb,
            HEARTBEAT_QOS,
        )

        self.create_timer(0.2, self._tick_motion)
        self.create_timer(0.5, self._tick_publish)
        self.create_timer(0.5, self._tick_peers)

        self._sm = None
        if bool(self.get_parameter('enable_yasmin_thread').value):
            self._sm = create_swarm_fsm('endendend_swarm', ns or f'drone{drone_id}')
            start_fsm_thread(self._sm, self._bb)

        self.get_logger().info(
            f'Drone controller up ({self._drone_label}) sim_mode={self._sim_mode} p2p_port={self._p2p_port}'
        )

    def _heartbeat_cb(self, msg: Heartbeat) -> None:
        if msg.drone_id:
            self._peer_ids.add(msg.drone_id)

    def _tick_peers(self) -> None:
        if self._sim_mode:
            self._bb['peer_count'] = 4
        else:
            others = {d for d in self._peer_ids if d != self._drone_label}
            self._bb['peer_count'] = len(others)
        self._bb['depth'] = float(self._depth)

    def _tick_motion(self) -> None:
        t = self.get_clock().now().nanoseconds * 1e-9
        twist = Twist()
        twist.linear.z = 0.1 * math.sin(t + self._drone_id)
        self._cmd_vel_pub.publish(twist)
        self._depth += 0.01 * twist.linear.z

    def _tick_publish(self) -> None:
        msg = DroneState()
        msg.drone_id = self._drone_label
        try:
            msg.fsm_state = 'EXPLORING' if self._bb['election_role'] == 'elected' else 'RELAYING'
        except KeyError:
            msg.fsm_state = 'DISCOVERY'
        msg.pose = Pose()
        msg.pose.position.z = float(self._depth)
        msg.twist = Twist()
        msg.battery = 0.85
        msg.stamp = self.get_clock().now().to_msg()
        self._state_pub.publish(msg)

        hb = Heartbeat()
        hb.drone_id = self._drone_label
        hb.stamp = msg.stamp
        hb.depth = float(self._depth)
        try:
            hb.peers_seen = int(self._bb['peer_count'])
        except (KeyError, TypeError, ValueError):
            hb.peers_seen = 0
        self._heartbeat_pub.publish(hb)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = DroneController()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
