#!/usr/bin/env python3
"""Global ROS2swarm-style behaviors + per-drone potential fields."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, GroupAction, OpaqueFunction
from launch.substitutions import LaunchConfiguration, TextSubstitution
from launch_ros.actions import Node, PushRosNamespace


def _behaviors(context, *args, **kwargs):
    num = int(LaunchConfiguration('num_drones').perform(context))
    num = max(1, min(num, 10))
    use_pf = LaunchConfiguration('enable_potential_fields').perform(context).lower() in (
        '1',
        'true',
        'yes',
    )
    actions = [
        Node(
            package='endendend_ros2swarm',
            executable='relay_chain_behavior',
            name='relay_chain_behavior',
            parameters=[{'num_drones': num}],
            output='screen',
        ),
        Node(
            package='endendend_ros2swarm',
            executable='victim_handoff_behavior',
            name='victim_handoff_behavior',
            parameters=[{'num_drones': num}],
            output='screen',
        ),
        Node(
            package='endendend_ros2swarm',
            executable='sector_realloc_behavior',
            name='sector_realloc_behavior',
            parameters=[{'num_drones': num}],
            output='screen',
        ),
    ]
    if use_pf:
        for i in range(num):
            actions.append(
                GroupAction(
                    [
                        PushRosNamespace(TextSubstitution(text=f'drone{i}')),
                        Node(
                            package='endendend_ros2swarm',
                            executable='potential_fields_controller',
                            name='potential_fields',
                            parameters=[
                                {
                                    'drone_id': i,
                                    'chain_target_depth': 50.0,
                                    'control_rate_hz': 20.0,
                                }
                            ],
                            output='screen',
                        ),
                    ]
                )
            )
    return actions


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument(
                'enable_potential_fields',
                default_value='true',
                description='If true, spawn namespaced potential-fields controllers (20Hz)',
            ),
            OpaqueFunction(function=_behaviors),
        ]
    )
