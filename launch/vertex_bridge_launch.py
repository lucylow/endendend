"""Wrapper: Vertex ROS 2 bridge."""

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
            DeclareLaunchArgument('foxmq_broker_port', default_value='1883'),
            DeclareLaunchArgument('vertex_discovery_port', default_value='5353'),
            DeclareLaunchArgument('swarm_domain_id', default_value='0'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(os.path.join(pkg, 'launch', 'vertex_bridge_launch.py')),
                launch_arguments={
                    'foxmq_broker_port': LaunchConfiguration('foxmq_broker_port'),
                    'vertex_discovery_port': LaunchConfiguration('vertex_discovery_port'),
                    'swarm_domain_id': LaunchConfiguration('swarm_domain_id'),
                }.items(),
            ),
        ]
    )
