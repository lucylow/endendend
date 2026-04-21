#!/usr/bin/env python3
"""Leaderless potential fields: tunnel depth attraction + peer repulsion + victim pull."""

from __future__ import annotations

import math
from typing import List, Optional, Tuple

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import Float64MultiArray

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import DroneState, SwarmGlobalState, VictimDetection


def _norm3(v: Tuple[float, float, float]) -> float:
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])


def _sub3(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add3(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _scale3(s: float, v: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (s * v[0], s * v[1], s * v[2])


class PotentialFieldsController(Node):
    def __init__(self) -> None:
        super().__init__('potential_fields_controller')
        self.declare_parameter('drone_id', 0)
        self.declare_parameter('chain_target_depth', 50.0)
        self.declare_parameter('repel_radius', 3.0)
        self.declare_parameter('attract_gain', 0.35)
        self.declare_parameter('repel_gain', 0.6)
        self.declare_parameter('victim_gain', 1.2)
        self.declare_parameter('control_rate_hz', 20.0)

        self._drone_id = int(self.get_parameter('drone_id').value)
        self._pose: Tuple[float, float, float] = (0.0, 0.0, 0.0)
        self._peers_flat: List[float] = []
        self._victim: Optional[Tuple[float, float, float]] = None
        self._last_swarm: Optional[SwarmGlobalState] = None

        self.create_subscription(DroneState, 'state', self._state_cb, CRITICAL_QOS)
        self.create_subscription(SwarmGlobalState, '/swarm/global_state', self._swarm_cb, CRITICAL_QOS)
        self.create_subscription(Float64MultiArray, '/swarm/peer_poses', self._peers_cb, 10)
        self.create_subscription(VictimDetection, 'victim_detections', self._victim_cb, 10)

        # Separate topic so ``drone_controller`` can merge (avoids two publishers on ``cmd_vel``).
        self._cmd_pub = self.create_publisher(Twist, 'cmd_vel_swarm', 10)
        period = 1.0 / max(1.0, float(self.get_parameter('control_rate_hz').value))
        self.create_timer(period, self._tick)
        self.get_logger().info(f'Potential fields active for drone {self._drone_id}')

    def _state_cb(self, msg: DroneState) -> None:
        self._pose = (
            float(msg.pose.position.x),
            float(msg.pose.position.y),
            float(msg.pose.position.z),
        )

    def _swarm_cb(self, msg: SwarmGlobalState) -> None:
        self._last_swarm = msg

    def _peers_cb(self, msg: Float64MultiArray) -> None:
        self._peers_flat = list(msg.data)

    def _victim_cb(self, msg: VictimDetection) -> None:
        if not msg.centroids:
            self._victim = None
            return
        if len(msg.confidences) == len(msg.centroids) and msg.confidences:
            i = max(range(len(msg.confidences)), key=lambda j: msg.confidences[j])
            c = msg.centroids[i]
        else:
            c = msg.centroids[0]
        self._victim = (float(c.x), float(c.y), float(c.z))

    def _peer_positions(self) -> List[Tuple[int, Tuple[float, float, float]]]:
        out: List[Tuple[int, Tuple[float, float, float]]] = []
        if self._last_swarm is not None:
            for st in self._last_swarm.drones:
                idx = self._parse_drone_index(st.drone_id)
                if idx is None:
                    continue
                p = (
                    float(st.pose.position.x),
                    float(st.pose.position.y),
                    float(st.pose.position.z),
                )
                out.append((idx, p))
            return out
        # Fallback: decode flat array [x,y,z]*N in chain order
        data = self._peers_flat
        if len(data) % 3 != 0:
            return out
        n = len(data) // 3
        for i in range(n):
            out.append(
                (
                    i,
                    (float(data[3 * i]), float(data[3 * i + 1]), float(data[3 * i + 2])),
                )
            )
        return out

    @staticmethod
    def _parse_drone_index(label: str) -> Optional[int]:
        label = label.strip('/')
        if not label.startswith('drone'):
            return None
        try:
            return int(label[5:])
        except ValueError:
            return None

    def _tick(self) -> None:
        target_z = float(self.get_parameter('chain_target_depth').value)
        repel_r = float(self.get_parameter('repel_radius').value)
        ag = float(self.get_parameter('attract_gain').value)
        rg = float(self.get_parameter('repel_gain').value)
        vg = float(self.get_parameter('victim_gain').value)

        attract = (0.0, 0.0, (target_z - self._pose[2]) * ag)
        repel = [0.0, 0.0, 0.0]
        for idx, peer in self._peer_positions():
            if idx == self._drone_id:
                continue
            delta = _sub3(self._pose, peer)
            dist = _norm3(delta)
            if dist < repel_r and dist > 0.05:
                inv = rg / (dist * dist)
                repel[0] += (delta[0] / dist) * inv
                repel[1] += (delta[1] / dist) * inv
                repel[2] += (delta[2] / dist) * inv

        total = _add3(attract, (repel[0], repel[1], repel[2]))
        if self._victim is not None:
            vd = _sub3(self._victim, self._pose)
            dist = _norm3(vd)
            if dist > 0.05 and dist < 40.0:
                pull = _scale3(vg / dist, vd)
                total = _add3(_scale3(0.65, pull), _scale3(0.35, (repel[0], repel[1], repel[2])))

        twist = Twist()
        twist.linear.x = max(-1.0, min(1.0, total[0]))
        twist.linear.y = max(-1.0, min(1.0, total[1]))
        twist.linear.z = max(-1.0, min(1.0, total[2]))
        self._cmd_pub.publish(twist)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = PotentialFieldsController()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
