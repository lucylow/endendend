#!/usr/bin/env python3
"""CHAIN pattern: depth-ordered relay; publishes ``/swarm/peer_poses`` + ``/swarm/chain_order``."""

from __future__ import annotations

import json
from typing import List, Optional

import rclpy
from rclpy.node import Node
from std_msgs.msg import Float64MultiArray, Int32MultiArray, String

from endendend_core.qos_profiles import CRITICAL_QOS
from endendend_msgs.msg import DroneState, SwarmGlobalState


class RelayChainBehavior(Node):
    def __init__(self) -> None:
        super().__init__('relay_chain_behavior')
        self.declare_parameter('num_drones', 5)
        self._num = int(self.get_parameter('num_drones').value)
        self._last: Optional[SwarmGlobalState] = None
        self._override: Optional[List[int]] = None

        self.create_subscription(SwarmGlobalState, '/swarm/global_state', self._swarm_cb, CRITICAL_QOS)
        self.create_subscription(String, '/vertex/broadcast', self._vertex_cb, 10)
        self._poses_pub = self.create_publisher(Float64MultiArray, '/swarm/peer_poses', 10)
        self._order_pub = self.create_publisher(Int32MultiArray, '/swarm/chain_order', 10)
        self.create_timer(0.1, self._tick)
        self.get_logger().info('Relay chain coordinator publishing peer poses + chain order.')

    def _swarm_cb(self, msg: SwarmGlobalState) -> None:
        self._last = msg

    def _vertex_cb(self, msg: String) -> None:
        try:
            blob = json.loads(msg.data)
            if isinstance(blob, dict) and blob.get('channel') == 'chain_order':
                ids = blob.get('order')
                if isinstance(ids, list):
                    self._override = [int(x) for x in ids]
        except Exception:
            pass

    @staticmethod
    def _idx(label: str) -> int:
        label = label.strip('/')
        if label.startswith('drone'):
            try:
                return int(label[5:])
            except ValueError:
                return 0
        return 0

    def _tick(self) -> None:
        if self._last is None or not self._last.drones:
            return
        drones = list(self._last.drones)
        drones.sort(key=lambda d: (-d.pose.position.z, self._idx(d.drone_id)))

        order: List[int] = []
        flat: List[float] = []
        for st in drones:
            i = self._idx(st.drone_id)
            order.append(i)
            flat.extend(
                [
                    float(st.pose.position.x),
                    float(st.pose.position.y),
                    float(st.pose.position.z),
                ]
            )

        if self._override is not None and len(self._override) == len(order):
            order = self._override
            idx_to_st = {self._idx(d.drone_id): d for d in drones}
            flat = []
            for iid in order:
                st = idx_to_st.get(iid)
                if st is None:
                    continue
                flat.extend(
                    [
                        float(st.pose.position.x),
                        float(st.pose.position.y),
                        float(st.pose.position.z),
                    ]
                )

        pm = Float64MultiArray()
        pm.data = flat
        self._poses_pub.publish(pm)

        om = Int32MultiArray()
        om.data = order
        self._order_pub.publish(om)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = RelayChainBehavior()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
