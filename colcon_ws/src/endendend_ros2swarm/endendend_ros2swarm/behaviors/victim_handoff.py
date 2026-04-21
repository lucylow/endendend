#!/usr/bin/env python3
"""Aggregation-style handoff: closest drone to victim centroid bids extractor role."""

from __future__ import annotations

import json
import math
from typing import Dict, List, Optional, Tuple

import rclpy
from geometry_msgs.msg import Point
from rclpy.node import Node
from std_msgs.msg import String

from endendend_msgs.msg import DroneState, SwarmGlobalState, VictimDetection


class VictimHandoffBehavior(Node):
    def __init__(self) -> None:
        super().__init__('victim_handoff_behavior')
        self.declare_parameter('num_drones', 5)
        self.declare_parameter('bid_distance', 8.0)
        self._num = int(self.get_parameter('num_drones').value)
        self._bid_d = float(self.get_parameter('bid_distance').value)
        self._swarm: Optional[SwarmGlobalState] = None
        self._victims: Dict[int, VictimDetection] = {}

        self.create_subscription(SwarmGlobalState, '/swarm/global_state', self._swarm_cb, 10)
        for i in range(self._num):
            self.create_subscription(
                VictimDetection,
                f'/drone{i}/victim_detections',
                self._make_victim_cb(i),
                10,
            )
        self._role_pub = self.create_publisher(String, '/vertex/role_update', 10)
        self._bid_pub = self.create_publisher(String, '/vertex/role_bids', 10)
        self.create_timer(0.5, self._tick)
        self.get_logger().info('Victim handoff behavior listening for detections.')

    def _swarm_cb(self, msg: SwarmGlobalState) -> None:
        self._swarm = msg

    def _make_victim_cb(self, idx: int):
        def _cb(msg: VictimDetection) -> None:
            self._victims[idx] = msg

        return _cb

    @staticmethod
    def _primary_centroid(det: VictimDetection) -> Optional[Point]:
        if not det.centroids:
            return None
        if len(det.confidences) == len(det.centroids) and det.confidences:
            i = max(range(len(det.confidences)), key=lambda j: det.confidences[j])
            return det.centroids[i]
        return det.centroids[0]

    @staticmethod
    def _pose_for(drones: List[DroneState], target: int) -> Optional[Tuple[float, float, float]]:
        for st in drones:
            lab = st.drone_id.strip('/')
            if lab == f'drone{target}':
                return (
                    float(st.pose.position.x),
                    float(st.pose.position.y),
                    float(st.pose.position.z),
                )
        return None

    def _tick(self) -> None:
        if self._swarm is None or not self._swarm.drones:
            return
        best: Tuple[float, int] | None = None
        for did, det in self._victims.items():
            if det.victim_count <= 0 or not det.centroids:
                continue
            pose = self._pose_for(list(self._swarm.drones), did)
            if pose is None:
                continue
            c = self._primary_centroid(det)
            if c is None:
                continue
            dist = math.sqrt(
                (c.x - pose[0]) ** 2 + (c.y - pose[1]) ** 2 + (c.z - pose[2]) ** 2
            )
            if dist < self._bid_d:
                if best is None or dist < best[0]:
                    best = (dist, did)
        if best is None:
            return
        _, winner = best
        bid = {
            'type': 'handoff_bid',
            'drone_id': winner,
            'dist': best[0],
            'role': 'extractor',
        }
        m = String()
        m.data = json.dumps(bid)
        self._bid_pub.publish(m)
        role = String()
        role.data = json.dumps({'extractor': winner, 'dist': best[0]})
        self._role_pub.publish(role)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = VictimHandoffBehavior()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
