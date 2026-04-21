"""Wrapper: Webots swarm profile (aggregator + failure injector + blackout stack)."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    inner = os.path.join(pkg, 'launch', 'webots_swarm_launch.py')
    default_world = os.path.join(pkg, 'worlds', 'blackout_tunnel.wbt')
    return LaunchDescription(
        [
            DeclareLaunchArgument('world_file', default_value=default_world),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            DeclareLaunchArgument('num_drones', default_value='5'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(inner),
                launch_arguments={
                    'world_file': LaunchConfiguration('world_file'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                    'num_drones': LaunchConfiguration('num_drones'),
                }.items(),
            ),
        ]
    )
