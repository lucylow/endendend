"""Wrapper: single-drone Track 2 template."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0'),
            DeclareLaunchArgument('onnx_model_path', default_value=''),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg, 'launch', 'drone_template_launch.py')),
                launch_arguments={
                    'drone_id': LaunchConfiguration('drone_id'),
                    'onnx_model_path': LaunchConfiguration('onnx_model_path'),
                    'heartbeat_interval': LaunchConfiguration('heartbeat_interval'),
                    'election_timeout': LaunchConfiguration('election_timeout'),
                }.items(),
            ),
        ]
    )
