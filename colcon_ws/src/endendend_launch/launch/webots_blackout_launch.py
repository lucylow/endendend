#!/usr/bin/env python3
"""Webots blackout tunnel (optional process) + network loss emulator (no hard ``webots_ros2`` dependency)."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _maybe_webots(context, *args, **kwargs):
    if LaunchConfiguration('launch_webots').perform(context).lower() not in ('1', 'true', 'yes'):
        return []
    wf = LaunchConfiguration('world_file').perform(context)
    if not os.path.isfile(wf):
        return []
    return [ExecuteProcess(cmd=['webots', '--batch', '--mode=fast', wf], output='screen')]


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    default_world = os.path.join(pkg, 'worlds', 'blackout_tunnel.wbt')
    return LaunchDescription(
        [
            DeclareLaunchArgument(
                'world_file',
                default_value=default_world,
                description='Path to Webots .wbt (install/share or repo worlds/)',
            ),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            Node(
                package='endendend_supervisor',
                executable='network_emulator',
                name='network_emulator',
                parameters=[
                    {
                        'tunnel_length': 200.0,
                        'network_loss_factor': 0.01,
                        'failure_injection_rate': 0.05,
                    }
                ],
                output='screen',
            ),
            OpaqueFunction(function=_maybe_webots),
        ]
    )
