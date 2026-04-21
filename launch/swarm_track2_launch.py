"""Wrapper: Track 2 swarm (forwards args to ``endendend_launch``)."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    vshare = get_package_share_directory('endendend_vision')
    child = os.path.join(pkg, 'launch', 'swarm_track2_launch.py')
    default_world = os.path.join(pkg, 'worlds', 'blackout_tunnel.wbt')
    default_onnx = os.path.join(vshare, 'models', 'best.onnx')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument('world_file', default_value=default_world),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            DeclareLaunchArgument('enable_rviz', default_value='false'),
            DeclareLaunchArgument('onnx_model_path', default_value=default_onnx),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            DeclareLaunchArgument('use_ros2swarm', default_value='true'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(child),
                launch_arguments={
                    'num_drones': LaunchConfiguration('num_drones'),
                    'world_file': LaunchConfiguration('world_file'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                    'enable_rviz': LaunchConfiguration('enable_rviz'),
                    'onnx_model_path': LaunchConfiguration('onnx_model_path'),
                    'heartbeat_interval': LaunchConfiguration('heartbeat_interval'),
                    'election_timeout': LaunchConfiguration('election_timeout'),
                    'use_ros2swarm': LaunchConfiguration('use_ros2swarm'),
                }.items(),
            ),
        ]
    )
