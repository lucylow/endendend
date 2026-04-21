"""Wrapper: forwards ``drone_id`` to packaged single-drone launch."""

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
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(
                    os.path.join(pkg, 'launch', 'single_drone_launch.py')
                ),
                launch_arguments={'drone_id': LaunchConfiguration('drone_id')}.items(),
            ),
        ]
    )
