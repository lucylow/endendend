"""Synthetic camera stream for Webots / bench (``sensor_msgs/Image``)."""

from __future__ import annotations

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image


class WebotsCameraStub(Node):
    def __init__(self) -> None:
        super().__init__('webots_camera')
        self.declare_parameter('frame_id', 'camera')
        self.declare_parameter('width', 320)
        self.declare_parameter('height', 240)
        self._pub = self.create_publisher(Image, 'image_raw', 10)
        self.create_timer(0.1, self._tick)

    def _tick(self) -> None:
        w = int(self.get_parameter('width').value)
        h = int(self.get_parameter('height').value)
        msg = Image()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = str(self.get_parameter('frame_id').value)
        msg.height = h
        msg.width = w
        msg.encoding = 'mono8'
        msg.is_bigendian = 0
        msg.step = w
        msg.data = bytes([42] * (w * h))
        self._pub.publish(msg)


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = WebotsCameraStub()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
