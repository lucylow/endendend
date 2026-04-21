import os
from pathlib import Path

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, SetEnvironmentVariable
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for p in [here.parent, *here.parents]:
        if (p / "vision" / "yolo_onnx.py").is_file():
            return p
    return here.parents[4]


def generate_launch_description() -> LaunchDescription:
    repo_root = _repo_root()
    py_path = str(repo_root)
    if os.environ.get("PYTHONPATH"):
        py_path = py_path + os.pathsep + os.environ["PYTHONPATH"]

    model_default = str((repo_root / "models" / "victim_yolov8" / "best.onnx").resolve())

    return LaunchDescription(
        [
            SetEnvironmentVariable(name="PYTHONPATH", value=py_path),
            DeclareLaunchArgument("model_path", default_value=model_default),
            DeclareLaunchArgument("source_drone_id", default_value="drone_0"),
            DeclareLaunchArgument("conf_threshold", default_value="0.5"),
            Node(
                package="tashi_vision",
                executable="yolov8_swarm_vision",
                name="yolov8_swarm_vision",
                parameters=[
                    {
                        "model_path": LaunchConfiguration("model_path"),
                        "source_drone_id": LaunchConfiguration("source_drone_id"),
                        "conf_threshold": LaunchConfiguration("conf_threshold"),
                    }
                ],
                output="screen",
            ),
        ]
    )
