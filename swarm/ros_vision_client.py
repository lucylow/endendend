"""Optional rclpy subscriber: ``VictimDetections`` → ``DroneController`` victim pipeline."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any, Dict

if TYPE_CHECKING:
    from swarm.drone_controller import DroneController

logger = logging.getLogger(__name__)


class RosVisionClient:
    """Call ``spin_once`` from the Webots control loop (one process per drone)."""

    def __init__(self, controller: "DroneController", drone_id: str, topic: str = "/victim_detections") -> None:
        import rclpy
        from rclpy.node import Node
        from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy

        from tashi_msgs.msg import VictimDetections

        if not rclpy.ok():
            rclpy.init()

        class _N(Node):
            pass

        self._node = _N("swarm_vision_%s" % drone_id.replace("-", "_"))
        self._controller = controller
        self._drone_id = drone_id

        qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
            history=HistoryPolicy.KEEP_LAST,
            depth=8,
        )

        def _cb(msg: VictimDetections) -> None:
            if str(msg.source_drone_id) != self._drone_id:
                return
            for vd in msg.detections:
                payload = _victim_detection_to_wire(self._drone_id, vd)
                self._controller.ingest_vision_victim(payload)

        self._node.create_subscription(VictimDetections, topic, _cb, qos)
        self._logger = self._node.get_logger()
        self._logger.info("ROS2 vision ingest on %s for %s", topic, drone_id)

    def spin_once(self) -> None:
        import rclpy

        rclpy.spin_once(self._node, timeout_sec=0.0)

    def shutdown(self) -> None:
        import rclpy

        self._node.destroy_node()
        if rclpy.ok():
            try:
                rclpy.shutdown()
            except Exception:  # pragma: no cover
                pass


def _victim_detection_to_wire(drone_id: str, vd: Any) -> Dict[str, Any]:
    return {
        "type": "VICTIM_DETECTED",
        "id": "%s_ros_%s" % (drone_id, int(getattr(vd, "track_id", -1))),
        "location": [float(vd.pose.x), float(vd.pose.y), float(vd.pose.theta)],
        "confidence": float(getattr(vd, "confidence", 0.0)),
        "sensor": "yolov8_ros",
        "drone_id": drone_id,
        "track_id": int(getattr(vd, "track_id", -1)),
        "timestamp": time.time(),
    }
