#!/usr/bin/env python3
"""Track 2 vision stack (camera + YOLOv8 ONNX) — forwards args to ``vision_launch.py``."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_vision')
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0'),
            DeclareLaunchArgument('model_path', default_value=''),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg, 'launch', 'vision_launch.py')),
                launch_arguments={
                    'drone_id': LaunchConfiguration('drone_id'),
                    'model_path': LaunchConfiguration('model_path'),
                }.items(),
            ),
        ]
    )
