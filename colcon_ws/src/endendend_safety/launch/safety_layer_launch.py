#!/usr/bin/env python3
"""Per-drone safety stack + swarm coordinator + optional hardware mock + recovery service."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, GroupAction, OpaqueFunction
from launch.substitutions import LaunchConfiguration, TextSubstitution
from launch_ros.actions import Node, PushRosNamespace


def _safety_stack(context, *args, **kwargs):
    num = int(LaunchConfiguration('num_drones').perform(context))
    num = max(1, min(num, 10))
    mock = LaunchConfiguration('use_hardware_mock').perform(context).lower() in ('1', 'true', 'yes')
    lidar = LaunchConfiguration('enable_lidar').perform(context).lower() in ('1', 'true', 'yes')
    actions = []
    for i in range(num):
        g = GroupAction(
            [
                PushRosNamespace(TextSubstitution(text=f'drone{i}')),
                Node(
                    package='endendend_safety',
                    executable='safety_watchdog',
                    name='safety_watchdog',
                    output='screen',
                ),
                Node(
                    package='endendend_safety',
                    executable='geofence_monitor',
                    name='geofence_monitor',
                    output='screen',
                ),
                Node(
                    package='endendend_safety',
                    executable='bms_monitor',
                    name='bms_monitor',
                    output='screen',
                ),
                Node(
                    package='endendend_safety',
                    executable='collision_avoid',
                    name='collision_avoid',
                    parameters=[{'enable_lidar': lidar}],
                    output='screen',
                ),
            ]
        )
        if mock:
            g.actions.append(
                Node(
                    package='endendend_safety',
                    executable='hardware_mock',
                    name='hardware_mock',
                    output='screen',
                )
            )
        actions.append(g)
    actions.append(
        Node(
            package='endendend_safety',
            executable='swarm_safety',
            name='swarm_safety',
            parameters=[{'num_drones': num}],
            output='screen',
        )
    )
    actions.append(
        Node(
            package='endendend_safety',
            executable='estop_recovery',
            name='estop_recovery',
            output='screen',
        )
    )
    return actions


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument(
                'use_hardware_mock',
                default_value='true',
                description='Publish synthetic battery/temperature per drone namespace',
            ),
            DeclareLaunchArgument(
                'enable_lidar',
                default_value='false',
                description='Subscribe to namespaced scan (requires sensor in sim)',
            ),
            OpaqueFunction(function=_safety_stack),
        ]
    )
