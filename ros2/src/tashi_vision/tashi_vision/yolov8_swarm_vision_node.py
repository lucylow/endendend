"""Subscribe camera, run YOLOv8 ONNX + tracker, publish VictimDetections (BEST_EFFORT QoS)."""

from __future__ import annotations

import os
from typing import List, Optional, Tuple

import onnxruntime as ort
import rclpy
from cv_bridge import CvBridge
from geometry_msgs.msg import Pose2D
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import Image
from std_msgs.msg import Header

from tashi_msgs.msg import VictimDetection, VictimDetections

from tashi_vision._repo_path import ensure_repo_root_on_path

ensure_repo_root_on_path()

from vision.detection_to_vertex import tracked_to_victim_messages  # noqa: E402
from vision.victim_tracker import VictimTracker  # noqa: E402
from vision.yolo_onnx import run_session  # noqa: E402


def _vision_qos() -> QoSProfile:
    return QoSProfile(
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.VOLATILE,
        history=HistoryPolicy.KEEP_LAST,
        depth=5,
    )


class YoloV8SwarmVisionNode(Node):
    def __init__(self) -> None:
        super().__init__("yolov8_swarm_vision")
        self.declare_parameter("model_path", "models/victim_yolov8/best.onnx")
        self.declare_parameter("source_drone_id", "drone_0")
        self.declare_parameter("conf_threshold", 0.5)
        self.declare_parameter("gps_fallback_x", 0.0)
        self.declare_parameter("gps_fallback_y", 0.0)
        self.declare_parameter("gps_fallback_z", 2.0)

        model_path = os.path.expanduser(str(self.get_parameter("model_path").value))
        if not os.path.isabs(model_path):
            root = ensure_repo_root_on_path()
            if root is not None:
                model_path = str((root / model_path).resolve())
        self._source_drone = str(self.get_parameter("source_drone_id").value)
        self._conf = float(self.get_parameter("conf_threshold").value)
        self._gps = (
            float(self.get_parameter("gps_fallback_x").value),
            float(self.get_parameter("gps_fallback_y").value),
            float(self.get_parameter("gps_fallback_z").value),
        )

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = int(os.environ.get("ORT_INTRA_THREADS", "4"))
        if not os.path.isfile(model_path):
            raise FileNotFoundError("ONNX model not found: %s" % model_path)
        try:
            self._session = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("Failed to load ONNX model %s: %s" % (model_path, exc)) from exc
        self._input_name = self._session.get_inputs()[0].name
        self._bridge = CvBridge()
        self._tracker = VictimTracker(min_hits=2, max_age=20, iou_match=0.35)
        self._last_img_shape = (480, 640)

        qos = _vision_qos()
        self.create_subscription(Image, "/camera/image_raw", self._on_image, qos)
        self.create_subscription(Odometry, "/odom", self._on_odom, 10)
        self._pub = self.create_publisher(VictimDetections, "/victim_detections", qos)
        self._odom_gps: Optional[Tuple[float, float, float]] = None
        self.get_logger().info("YOLOv8 vision node ready model=%s drone=%s", model_path, self._source_drone)

    def _on_odom(self, msg: Odometry) -> None:
        self._odom_gps = (
            float(msg.pose.pose.position.x),
            float(msg.pose.pose.position.y),
            float(msg.pose.pose.position.z),
        )

    def _on_image(self, msg: Image) -> None:
        try:
            frame = self._bridge.imgmsg_to_cv2(msg, desired_encoding="bgr8")
        except Exception as exc:  # pragma: no cover
            self.get_logger().warning("cv_bridge failed: %s", exc)
            return
        h, w = frame.shape[:2]
        self._last_img_shape = (h, w)
        dets = run_session(self._session, self._input_name, frame, self._conf)
        tracks = self._tracker.update(dets)
        gps = self._odom_gps or self._gps
        payloads = tracked_to_victim_messages(self._source_drone, tracks, gps, (w, h))
        ros_dets: List[VictimDetection] = []
        for pl in payloads:
            loc = pl.get("location") or [0.0, 0.0, 0.0]
            vd = VictimDetection()
            vd.header = Header(stamp=msg.header.stamp, frame_id=msg.header.frame_id or "camera")
            vd.confidence = float(pl.get("confidence", 0.0))
            vd.pose = Pose2D(x=float(loc[0]), y=float(loc[1]), theta=float(loc[2]))
            vd.track_id = int(pl.get("track_id", -1))
            ros_dets.append(vd)
        out = VictimDetections()
        out.header = Header(stamp=msg.header.stamp, frame_id=msg.header.frame_id or "camera")
        out.source_drone_id = self._source_drone
        out.detections = ros_dets
        self._pub.publish(out)


def main(args: Optional[List[str]] = None) -> None:
    rclpy.init(args=args)
    node = YoloV8SwarmVisionNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
