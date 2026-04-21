"""BGR8 camera feed for the vision stack: OpenCV scene (default), USB capture, or legacy mono stub."""

from __future__ import annotations

import math
from typing import List, Optional

import cv2
import numpy as np
import rclpy
from cv_bridge import CvBridge
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import Image


def _vision_qos() -> QoSProfile:
    return QoSProfile(
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.VOLATILE,
        history=HistoryPolicy.KEEP_LAST,
        depth=3,
    )


class WebotsCamera(Node):
    """Publishes ``sensor_msgs/Image`` (``bgr8``) for YOLO — not a mocked detector path."""

    def __init__(self) -> None:
        super().__init__('webots_camera')
        self.declare_parameter('frame_id', 'victim_camera_link')
        self.declare_parameter('width', 640)
        self.declare_parameter('height', 480)
        self.declare_parameter('fps', 30.0)
        self.declare_parameter('source', 'opencv_scene')
        self.declare_parameter('video_device', -1)

        self._bridge = CvBridge()
        self._cap: Optional[cv2.VideoCapture] = None
        src = str(self.get_parameter('source').value).strip().lower()
        self._source = src
        dev = int(self.get_parameter('video_device').value)
        if src == 'video_device' and dev >= 0:
            self._cap = cv2.VideoCapture(dev)
            if not self._cap.isOpened():
                self.get_logger().error('video_device %s failed to open; falling back to opencv_scene' % dev)
                self._cap.release()
                self._cap = None
                self._source = 'opencv_scene'

        fps = max(1.0, float(self.get_parameter('fps').value))
        self._pub = self.create_publisher(Image, 'image_raw', _vision_qos())
        self.create_timer(1.0 / fps, self._tick)
        self._t = 0.0
        self.get_logger().info('Camera source=%s fps=%.1f' % (self._source, fps))

    def _read_usb(self) -> Optional[np.ndarray]:
        if self._cap is None:
            return None
        ok, frame = self._cap.read()
        if not ok or frame is None:
            return None
        return frame

    def _synthetic_scene(self, w: int, h: int) -> np.ndarray:
        """Moving high-contrast shapes (SAR-like targets) for pipeline / model bring-up."""
        self._t += 0.05
        img = np.zeros((h, w, 3), dtype=np.uint8)
        img[:] = (28, 32, 36)
        # Animated "victim" pillars (red/orange)
        for k in range(3):
            cx = int(w * (0.25 + 0.22 * k + 0.08 * math.sin(self._t + k)))
            cy = int(h * (0.45 + 0.05 * math.cos(self._t * 0.7 + k)))
            cv2.ellipse(
                img,
                (cx, cy),
                (35, 90),
                8.0 * k,
                0,
                360,
                (20, 60, 220),
                -1,
            )
            cv2.rectangle(img, (cx - 8, cy - 110), (cx + 8, cy + 110), (40, 120, 255), 2)
        cv2.GaussianBlur(img, (3, 3), 0, dst=img)
        return img

    def _stub_mono(self, w: int, h: int) -> np.ndarray:
        """Legacy mono pattern (single channel expanded to BGR)."""
        plane = np.full((h, w), 42, dtype=np.uint8)
        return cv2.cvtColor(plane, cv2.COLOR_GRAY2BGR)

    def _tick(self) -> None:
        w = int(self.get_parameter('width').value)
        h = int(self.get_parameter('height').value)
        w = max(32, min(w, 1920))
        h = max(32, min(h, 1080))

        if self._source == 'video_device' and self._cap is not None:
            frame = self._read_usb()
            if frame is None:
                frame = self._synthetic_scene(w, h)
            elif frame.shape[1] != w or frame.shape[0] != h:
                frame = cv2.resize(frame, (w, h), interpolation=cv2.INTER_LINEAR)
        elif self._source == 'stub_mono':
            frame = self._stub_mono(w, h)
        else:
            frame = self._synthetic_scene(w, h)

        msg = self._bridge.cv2_to_imgmsg(frame, encoding='bgr8')
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = str(self.get_parameter('frame_id').value)
        self._pub.publish(msg)

    def destroy_node(self) -> bool:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        return super().destroy_node()


def main(args: Optional[List[str]] = None) -> None:
    rclpy.init(args=args)
    node = WebotsCamera()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
