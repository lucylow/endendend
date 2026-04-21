#!/usr/bin/env python3
"""Per-namespace vision: BGR camera + YOLOv8 ONNX + tracker (no stub inference timer)."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0', description='Label for ``source_drone_id``'),
            DeclareLaunchArgument('model_path', default_value='', description='ONNX path (optional if env set)'),
            DeclareLaunchArgument('camera_source', default_value='opencv_scene'),
            DeclareLaunchArgument('camera_fps', default_value='30.0'),
            Node(
                package='endendend_vision',
                executable='webots_camera',
                name='victim_camera',
                parameters=[
                    {
                        'source': ParameterValue(LaunchConfiguration('camera_source'), value_type=str),
                        'fps': ParameterValue(LaunchConfiguration('camera_fps'), value_type=float),
                        'width': 640,
                        'height': 480,
                    }
                ],
                output='screen',
            ),
            Node(
                package='endendend_vision',
                executable='yolov8_onnx_detector',
                name='detector',
                parameters=[
                    {
                        'model_path': ParameterValue(LaunchConfiguration('model_path'), value_type=str),
                        'source_drone_id': ParameterValue(LaunchConfiguration('drone_id'), value_type=str),
                    }
                ],
                remappings=[('image_in', 'image_raw')],
                output='screen',
            ),
        ]
    )
