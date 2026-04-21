#!/usr/bin/env python3
"""Optional Webots process + notes for future ``webots_ros2`` driver integration."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, OpaqueFunction
from launch.substitutions import LaunchConfiguration


def _maybe_webots(context, *args, **kwargs):
    flag = LaunchConfiguration('launch_webots').perform(context).lower()
    if flag not in ('1', 'true', 'yes'):
        return []
    wp = LaunchConfiguration('world_path').perform(context)
    if not os.path.isfile(wp):
        return []
    return [
        ExecuteProcess(
            cmd=['webots', '--batch', '--mode=fast', wp],
            output='screen',
        )
    ]


def generate_launch_description() -> LaunchDescription:
    pkg_share = get_package_share_directory('endendend_launch')
    default_world = os.path.join(pkg_share, 'worlds', 'blackout_swarm.wbt')
    return LaunchDescription(
        [
            DeclareLaunchArgument(
                'world_path',
                default_value=default_world,
                description='Webots world (.wbt). Packaged under endendend_launch/share/worlds when available.',
            ),
            DeclareLaunchArgument(
                'launch_webots',
                default_value='false',
                description='If true, spawn local webots binary (requires webots on PATH)',
            ),
            OpaqueFunction(function=_maybe_webots),
        ]
    )
