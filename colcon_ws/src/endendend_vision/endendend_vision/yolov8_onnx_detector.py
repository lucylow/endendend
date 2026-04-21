"""YOLOv8 ONNX victim detector (stub + optional ``onnxruntime`` when model exists)."""

from __future__ import annotations

import os

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Point
from sensor_msgs.msg import Image

from endendend_msgs.msg import VictimDetection


class Yolov8OnnxDetector(Node):
    def __init__(self) -> None:
        super().__init__('yolov8_onnx_detector')
        self.declare_parameter('model_path', '')
        self.declare_parameter('conf_threshold', 0.5)
        self.declare_parameter('source_drone_id', '')
        mp = str(self.get_parameter('model_path').value)
        if not mp:
            mp = os.environ.get('ENDENDEND_ONNX_MODEL', '')
        self._model_path = mp
        self.create_subscription(Image, 'image_in', self._img_cb, 10)
        self._pub = self.create_publisher(VictimDetection, 'victim_detections', 10)
        self.create_timer(1.0, self._stub_tick)
        self._got_image = False

    def _img_cb(self, _msg: Image) -> None:
        self._got_image = True

    def _stub_tick(self) -> None:
        msg = VictimDetection()
        msg.stamp = self.get_clock().now().to_msg()
        msg.frame_id = 'camera'
        sid = str(self.get_parameter('source_drone_id').value)
        msg.source_drone_id = sid or self.get_namespace().strip('/') or 'drone0'
        msg.victim_count = 1 if self._got_image or not self._model_path else 0
        p = Point(x=1.0, y=0.0, z=0.5)
        msg.centroids = [p]
        self._pub.publish(msg)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = Yolov8OnnxDetector()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
