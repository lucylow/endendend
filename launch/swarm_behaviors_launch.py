"""Wrapper: ROS2swarm-style behaviors (``endendend_ros2swarm``)."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_ros2swarm')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument('enable_potential_fields', default_value='true'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg, 'launch', 'swarm_behaviors_launch.py')),
                launch_arguments={
                    'num_drones': LaunchConfiguration('num_drones'),
                    'enable_potential_fields': LaunchConfiguration('enable_potential_fields'),
                }.items(),
            ),
        ]
    )
