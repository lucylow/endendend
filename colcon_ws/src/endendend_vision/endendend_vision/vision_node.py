"""Publishes synthetic victim detections; set ENDENDEND_ONNX_MODEL for YOLOv8 ONNX path."""

from __future__ import annotations

import os

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Point
from sensor_msgs.msg import Image

from endendend_msgs.msg import VictimDetection


class VisionNode(Node):
    def __init__(self) -> None:
        super().__init__('endendend_vision')
        self.declare_parameter('source_drone_id', 'drone0')
        self.declare_parameter('victim_count', 1)
        self._model = os.environ.get('ENDENDEND_ONNX_MODEL', '')
        if self._model:
            self.get_logger().info(f'ONNX model path set: {self._model}')
        else:
            self.get_logger().info('ENDENDEND_ONNX_MODEL unset; using stub detections.')

        self.create_subscription(Image, 'image_in', self._img_cb, 10)
        self._pub = self.create_publisher(VictimDetection, '/victim_detections', 10)
        self.create_timer(1.0, self._tick)

    def _img_cb(self, _msg: Image) -> None:
        pass

    def _tick(self) -> None:
        msg = VictimDetection()
        msg.stamp = self.get_clock().now().to_msg()
        msg.frame_id = 'map'
        msg.source_drone_id = str(self.get_parameter('source_drone_id').value)
        msg.victim_count = int(self.get_parameter('victim_count').value)
        p = Point()
        p.x = 1.0
        p.y = 0.0
        p.z = 0.5
        msg.centroids = [p]
        msg.confidences = [0.5]
        msg.track_ids = [0]
        self._pub.publish(msg)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = VisionNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
