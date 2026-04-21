"""Legacy placeholder — use ``yolov8_swarm_vision`` + ``vision_swarm.launch.py`` for production YOLO."""

from __future__ import annotations

from typing import List, Optional

import rclpy
from rclpy.node import Node


class VisionNode(Node):
    def __init__(self) -> None:
        super().__init__("vision_node")
        self.get_logger().warning(
            "vision_node is deprecated — run: ros2 launch tashi_vision vision_swarm.launch.py "
            "(executable yolov8_swarm_vision, topic /victim_detections)"
        )


def main(args: Optional[List[str]] = None) -> None:
    rclpy.init(args=args)
    node = VisionNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
