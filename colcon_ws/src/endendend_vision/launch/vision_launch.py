#!/usr/bin/env python3
"""Per-namespace vision: synthetic Webots camera + YOLOv8 ONNX detector stub."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0', description='Label segment after drone namespace'),
            DeclareLaunchArgument('model_path', default_value='', description='ONNX model path (optional)'),
            Node(
                package='endendend_vision',
                executable='webots_camera',
                name='victim_camera',
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
