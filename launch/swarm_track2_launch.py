"""Wrapper: Track 2 swarm (forwards args to ``endendend_launch``)."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    child = os.path.join(pkg, 'launch', 'swarm_track2_launch.py')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            DeclareLaunchArgument('enable_rviz', default_value='false'),
            DeclareLaunchArgument('onnx_model_path', default_value=''),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(child),
                launch_arguments={
                    'num_drones': LaunchConfiguration('num_drones'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                    'enable_rviz': LaunchConfiguration('enable_rviz'),
                    'onnx_model_path': LaunchConfiguration('onnx_model_path'),
                    'heartbeat_interval': LaunchConfiguration('heartbeat_interval'),
                    'election_timeout': LaunchConfiguration('election_timeout'),
                }.items(),
            ),
        ]
    )
