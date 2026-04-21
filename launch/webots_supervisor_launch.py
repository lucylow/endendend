"""Wrapper: forwards Webots supervisor args (default world from ``endendend_launch`` share)."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    default_world = os.path.join(pkg, 'worlds', 'blackout_swarm.wbt')
    return LaunchDescription(
        [
            DeclareLaunchArgument('world_path', default_value=default_world),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(
                    os.path.join(pkg, 'launch', 'webots_supervisor_launch.py')
                ),
                launch_arguments={
                    'world_path': LaunchConfiguration('world_path'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                }.items(),
            ),
        ]
    )
