"""Subscribe camera ``Image``, run YOLOv8 ONNX + IoU tracker, publish ``VictimDetection`` (best-effort, drop-backlog)."""

from __future__ import annotations

import os
from typing import List, Optional

import onnxruntime as ort
import rclpy
from cv_bridge import CvBridge
from geometry_msgs.msg import Point
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import Image

from endendend_msgs.msg import VictimDetection

from endendend_vision._repo_path import ensure_repo_root_on_path

ensure_repo_root_on_path()

from vision.detection_to_vertex import estimate_world_location  # noqa: E402
from vision.victim_tracker import VictimTracker  # noqa: E402
from vision.yolo_onnx import run_session  # noqa: E402


def _vision_qos() -> QoSProfile:
    return QoSProfile(
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.VOLATILE,
        history=HistoryPolicy.KEEP_LAST,
        depth=5,
    )


def _resolve_model_path(raw: str) -> str:
    mp = (raw or '').strip()
    if not mp:
        mp = os.environ.get('ENDENDEND_ONNX_MODEL', '').strip()
    if not mp:
        root = ensure_repo_root_on_path()
        if root is not None:
            cand = root / 'models' / 'victim_yolov8' / 'best.onnx'
            if cand.is_file():
                mp = str(cand.resolve())
    if mp and not os.path.isabs(mp):
        root = ensure_repo_root_on_path()
        if root is not None:
            mp = str((root / mp).resolve())
    return mp


class Yolov8OnnxDetector(Node):
    def __init__(self) -> None:
        super().__init__('yolov8_onnx_detector')
        self.declare_parameter('model_path', '')
        self.declare_parameter('require_model', True)
        self.declare_parameter('conf_threshold', 0.5)
        self.declare_parameter('source_drone_id', '')
        self.declare_parameter('gps_fallback_x', 0.0)
        self.declare_parameter('gps_fallback_y', 0.0)
        self.declare_parameter('gps_fallback_z', 2.0)
        self.declare_parameter('tracker_min_hits', 2)
        self.declare_parameter('tracker_max_age', 25)
        self.declare_parameter('tracker_iou', 0.35)

        self._require_model = bool(self.get_parameter('require_model').value)
        self._conf = float(self.get_parameter('conf_threshold').value)
        self._gps = (
            float(self.get_parameter('gps_fallback_x').value),
            float(self.get_parameter('gps_fallback_y').value),
            float(self.get_parameter('gps_fallback_z').value),
        )
        sid = str(self.get_parameter('source_drone_id').value).strip()
        self._source_drone = sid or self.get_namespace().strip('/').replace('/', '_') or 'drone0'

        model_path = _resolve_model_path(str(self.get_parameter('model_path').value))
        self._session: Optional[object] = None
        self._input_name = ''

        if model_path and os.path.isfile(model_path):
            opts = ort.SessionOptions()
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            opts.intra_op_num_threads = int(os.environ.get('ORT_INTRA_THREADS', '4'))
            try:
                self._session = ort.InferenceSession(
                    model_path, sess_options=opts, providers=['CPUExecutionProvider']
                )
                self._input_name = self._session.get_inputs()[0].name
                self.get_logger().info('YOLOv8 ONNX loaded path=%s' % model_path)
            except Exception as exc:  # pragma: no cover
                self.get_logger().error('ONNX load failed: %s' % exc)
                if self._require_model:
                    raise
        else:
            msg = 'ONNX model not found (model_path=%r). Set model_path or ENDENDEND_ONNX_MODEL.' % model_path
            if self._require_model:
                raise FileNotFoundError(msg)
            self.get_logger().warning('%s Running without inference (require_model=false).' % msg)

        self._bridge = CvBridge()
        self._tracker = VictimTracker(
            min_hits=int(self.get_parameter('tracker_min_hits').value),
            max_age=int(self.get_parameter('tracker_max_age').value),
            iou_match=float(self.get_parameter('tracker_iou').value),
        )
        self._busy = False
        self._odom: Optional[Tuple[float, float, float]] = None

        qos = _vision_qos()
        self.create_subscription(Image, 'image_in', self._on_image, qos)
        self.create_subscription(Odometry, 'odom', self._on_odom, qos)
        self._pub = self.create_publisher(VictimDetection, 'victim_detections', qos)

    def _on_odom(self, msg: Odometry) -> None:
        self._odom = (
            float(msg.pose.pose.position.x),
            float(msg.pose.pose.position.y),
            float(msg.pose.pose.position.z),
        )

    def _on_image(self, msg: Image) -> None:
        if self._busy:
            return
        if self._session is None:
            return
        self._busy = True
        try:
            try:
                frame = self._bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')
            except Exception as exc:  # pragma: no cover
                self.get_logger().warning('cv_bridge failed: %s' % exc)
                return
            h, w = frame.shape[:2]
            dets = run_session(self._session, self._input_name, frame, self._conf)
            tracks = sorted(self._tracker.update(dets), key=lambda tr: tr.confidence, reverse=True)
            gps = self._odom or self._gps
            out = VictimDetection()
            out.stamp = msg.header.stamp
            out.frame_id = msg.header.frame_id or 'camera'
            out.source_drone_id = self._source_drone
            out.victim_count = len(tracks)
            cents: List[Point] = []
            confs: List[float] = []
            tids: List[int] = []
            for tr in tracks:
                loc = estimate_world_location(gps, tr.bbox, w, h)
                p = Point(x=float(loc[0]), y=float(loc[1]), z=float(loc[2]))
                cents.append(p)
                confs.append(float(tr.confidence))
                tids.append(int(tr.track_id))
            out.centroids = cents
            out.confidences = confs
            out.track_ids = tids
            self._pub.publish(out)
        except Exception as exc:  # pragma: no cover
            self.get_logger().error('vision inference failed: %s' % exc)
        finally:
            self._busy = False


def main(args: Optional[List[str]] = None) -> None:
    rclpy.init(args=args)
    node = Yolov8OnnxDetector()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
