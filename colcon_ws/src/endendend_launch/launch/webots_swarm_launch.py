#!/usr/bin/env python3
"""Webots swarm driver profile: simulation window + network emulation + failure injector + state aggregator.

This launch file is a compact entry point for judges / CI beside the full ``swarm_track2_launch.py`` stack.

Quickstart (after ``colcon build``)::

    source install/setup.bash
    ros2 launch endendend_launch webots_swarm_launch.py launch_webots:=true

Webots-only failure teleport + loss spike (requires Webots Python with ``rclpy`` for the supervisor controller)::

    ros2 service call /webots_supervisor/kill_drone std_srvs/srv/Empty
    ros2 service call /webots_supervisor/inject_loss std_srvs/srv/Empty

ROS-level drone kill (logical / aggregator; ``KillDrone.srv``), example request YAML ``{drone_id: 2}``.
"""

from __future__ import annotations

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    wb_py = os.path.join(pkg, 'launch', 'webots_blackout_launch.py')
    default_world = os.path.join(pkg, 'worlds', 'blackout_tunnel.wbt')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument('world_file', default_value=default_world),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(wb_py),
                launch_arguments={
                    'world_file': LaunchConfiguration('world_file'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                }.items(),
            ),
            Node(
                package='endendend_core',
                executable='swarm_state_aggregator',
                name='swarm_state_aggregator',
                parameters=[
                    {
                        'num_drones': ParameterValue(LaunchConfiguration('num_drones'), value_type=int),
                        'state_topic': 'state',
                    }
                ],
                output='screen',
            ),
            Node(
                package='endendend_supervisor',
                executable='failure_injector',
                name='failure_injector',
                parameters=[
                    {'num_drones': ParameterValue(LaunchConfiguration('num_drones'), value_type=int)}
                ],
                output='screen',
            ),
        ]
    )
