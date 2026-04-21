"""Wrapper: per-drone YASMIN + controller."""

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
            DeclareLaunchArgument('initial_depth', default_value='0.0'),
            DeclareLaunchArgument('vertex_port', default_value='19790'),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg, 'launch', 'yasmin_fsm_launch.py')),
                launch_arguments={
                    'drone_id': LaunchConfiguration('drone_id'),
                    'initial_depth': LaunchConfiguration('initial_depth'),
                    'vertex_port': LaunchConfiguration('vertex_port'),
                    'heartbeat_interval': LaunchConfiguration('heartbeat_interval'),
                    'election_timeout': LaunchConfiguration('election_timeout'),
                }.items(),
            ),
        ]
    )
