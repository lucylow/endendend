#!/usr/bin/env python3
"""Master swarm: namespaced drone groups, vision, aggregator, failure injector, Vertex P2P."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    GroupAction,
    IncludeLaunchDescription,
    OpaqueFunction,
)
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, TextSubstitution
from launch_ros.actions import Node, PushRosNamespace


def _swarm_setup(context, *args, **kwargs):
    num = int(LaunchConfiguration('num_drones').perform(context))
    num = max(1, min(num, 10))
    use_bridge = LaunchConfiguration('use_vertex_bridge').perform(context).lower() in (
        '1',
        'true',
        'yes',
    )
    use_p2p = LaunchConfiguration('use_vertex_p2p').perform(context).lower() in (
        '1',
        'true',
        'yes',
    )
    per_vision = LaunchConfiguration('use_per_drone_vision').perform(context).lower() in (
        '1',
        'true',
        'yes',
    )
    leader_depth = 0.0
    vision_share = get_package_share_directory('endendend_vision')
    vision_launch = os.path.join(vision_share, 'launch', 'vision_launch.py')
    actions = []
    for i in range(num):
        ns = f'drone{i}'
        group_actions = [
            PushRosNamespace(TextSubstitution(text=ns)),
            Node(
                package='endendend_drone',
                executable='drone_controller',
                name='controller',
                parameters=[
                    {
                        'drone_id': i,
                        'initial_depth': float(i * 2.0),
                        'swarm_leader_depth': leader_depth,
                        'vertex_peer_port': 19790 + i,
                        'sim_mode': False,
                    }
                ],
                output='screen',
            ),
        ]
        if per_vision:
            group_actions.append(
                IncludeLaunchDescription(
                    PythonLaunchDescriptionSource(vision_launch),
                    launch_arguments={
                        'drone_id': str(i),
                        'model_path': LaunchConfiguration('onnx_model_path').perform(context),
                    }.items(),
                )
            )
        actions.append(GroupAction(group_actions))
    actions.append(
        Node(
            package='endendend_core',
            executable='swarm_state_aggregator',
            name='swarm_state_aggregator',
            parameters=[{'num_drones': num, 'state_topic': 'state'}],
            output='screen',
        )
    )
    actions.append(
        Node(
            package='endendend_supervisor',
            executable='failure_injector',
            name='failure_injector',
            parameters=[{'num_drones': num}],
            output='screen',
        )
    )
    if not per_vision:
        actions.append(
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(vision_launch),
                launch_arguments={
                    'drone_id': '0',
                    'model_path': LaunchConfiguration('onnx_model_path').perform(context),
                }.items(),
            )
        )
    if use_bridge:
        actions.append(
            Node(
                package='endendend_core',
                executable='vertex_ros_bridge',
                name='vertex_ros_bridge',
                output='screen',
            )
        )
    if use_p2p:
        actions.append(
            Node(
                package='endendend_core',
                executable='vertex_p2p_sync',
                name='vertex_p2p_sync',
                parameters=[
                    {
                        'bind_port': 19990,
                        'peer_base_port': 19790,
                        'num_peers': num,
                        'enable_udp': False,
                    }
                ],
                output='screen',
            )
        )
    return actions


def generate_launch_description() -> LaunchDescription:
    pkg_share = get_package_share_directory('endendend_launch')
    default_world = os.path.join(pkg_share, 'worlds', 'blackout_swarm.wbt')
    sup = os.path.join(pkg_share, 'launch', 'webots_supervisor_launch.py')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5', description='Number of drones (1-10)'),
            DeclareLaunchArgument(
                'world_path',
                default_value=default_world,
                description='Path to Webots .wbt',
            ),
            DeclareLaunchArgument('use_vertex_bridge', default_value='true'),
            DeclareLaunchArgument('use_vertex_p2p', default_value='true'),
            DeclareLaunchArgument(
                'use_per_drone_vision',
                default_value='true',
                description='If true, include vision stack inside each drone namespace',
            ),
            DeclareLaunchArgument('onnx_model_path', default_value=''),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(sup),
                launch_arguments={
                    'world_path': LaunchConfiguration('world_path'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                }.items(),
            ),
            OpaqueFunction(function=_swarm_setup),
        ]
    )
