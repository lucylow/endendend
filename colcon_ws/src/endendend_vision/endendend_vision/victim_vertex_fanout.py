"""Fan-in per-drone ``VictimDetection`` topics and publish JSON on ``/swarm/vertex_broadcast`` (blackout-tolerant QoS)."""

from __future__ import annotations

import json
from typing import List, Optional

import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from std_msgs.msg import String

from endendend_msgs.msg import VictimDetection


class VictimVertexFanout(Node):
    def __init__(self) -> None:
        super().__init__('victim_vertex_fanout')
        self.declare_parameter('num_drones', 5)
        self.declare_parameter('topic_basename', 'victim_detections')
        n = max(1, min(int(self.get_parameter('num_drones').value), 32))
        base = str(self.get_parameter('topic_basename').value).strip() or 'victim_detections'
        self._pub = self.create_publisher(String, '/swarm/vertex_broadcast', qos_profile_sensor_data)
        self._subs: List[object] = []
        for i in range(n):
            topic = '/drone%d/%s' % (i, base)

            def _cb(msg: VictimDetection, drone_id: int = i) -> None:
                self._forward(drone_id, msg)

            self._subs.append(
                self.create_subscription(VictimDetection, topic, _cb, qos_profile_sensor_data)
            )
        self.get_logger().info('VictimVertexFanout n=%d pattern /drone{i}/%s' % (n, base))

    def _forward(self, drone_id: int, msg: VictimDetection) -> None:
        cents = [{'x': p.x, 'y': p.y, 'z': p.z} for p in msg.centroids]
        payload = {
            'channel': 'victim_vision',
            'drone_id': drone_id,
            'source_drone_id': msg.source_drone_id,
            'frame_id': msg.frame_id,
            'victim_count': int(msg.victim_count),
            'centroids': cents,
            'confidences': [float(c) for c in msg.confidences],
            'track_ids': [int(t) for t in msg.track_ids],
            'stamp': {'sec': msg.stamp.sec, 'nanosec': msg.stamp.nanosec},
        }
        out = String()
        out.data = json.dumps({'channel': 'victim_vision', 'payload': payload}, separators=(',', ':'))
        self._pub.publish(out)


def main(args: Optional[List[str]] = None) -> None:
    rclpy.init(args=args)
    node = VictimVertexFanout()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
