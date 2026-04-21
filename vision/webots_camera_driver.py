"""
Webots → ROS2 camera bridge.

When ``webots_ros2_driver`` is available, prefer its device abstraction. This module
documents the expected Webots ``Camera`` name (``victim_camera``) and frame size;
the ROS2 node ``tashi_vision.camera_publish_node`` can alternatively subscribe to
``webots_ros2``-published ``/camera/image_raw`` from your world file.
"""

# Expected Webots DEF (excerpt for worlds/*.wbt):
# DEF victim_camera Camera {
#   name "victim_camera"
#   width 640
#   height 480
#   fieldOfView 0.785
# }

EXPECTED_CAMERA_NAME = "victim_camera"
DEFAULT_WIDTH = 640
DEFAULT_HEIGHT = 480
