#!/usr/bin/env python3
"""
Track 2: Search & Rescue swarms — Vertex P2P, blackout tunnel, YOLOv8 + YASMIN, zero cloud.
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    GroupAction,
    IncludeLaunchDescription,
    OpaqueFunction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, TextSubstitution
from launch_ros.actions import Node, PushRosNamespace
from launch_ros.parameter_descriptions import ParameterValue


def _drone_fleet(context, *args, **kwargs):
    num = int(LaunchConfiguration('num_drones').perform(context))
    num = max(1, min(num, 10))
    elaunch = get_package_share_directory('endendend_launch')
    vshare = get_package_share_directory('endendend_vision')
    yasmin_py = os.path.join(elaunch, 'launch', 'yasmin_fsm_launch.py')
    stack_py = os.path.join(vshare, 'launch', 'vision_stack_launch.py')
    actions = []
    for i in range(num):
        actions.append(
            GroupAction(
                [
                    PushRosNamespace(TextSubstitution(text=f'drone{i}')),
                    IncludeLaunchDescription(
                        PythonLaunchDescriptionSource(yasmin_py),
                        launch_arguments={
                            'drone_id': str(i),
                            'initial_depth': str(float(i * 2.0)),
                            'vertex_port': str(19790 + i),
                            'heartbeat_interval': LaunchConfiguration('heartbeat_interval').perform(context),
                            'election_timeout': LaunchConfiguration('election_timeout').perform(context),
                        }.items(),
                    ),
                    IncludeLaunchDescription(
                        PythonLaunchDescriptionSource(stack_py),
                        launch_arguments={
                            'drone_id': str(i),
                            'model_path': LaunchConfiguration('onnx_model_path').perform(context),
                        }.items(),
                    ),
                ]
            )
        )
    return actions


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    default_world = os.path.join(pkg, 'worlds', 'blackout_tunnel.wbt')
    wb_py = os.path.join(pkg, 'launch', 'webots_blackout_launch.py')
    vb_py = os.path.join(pkg, 'launch', 'vertex_bridge_launch.py')
    rviz_cfg = os.path.join(pkg, 'config', 'track2_swarm.rviz')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument('world_file', default_value=default_world),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            DeclareLaunchArgument('enable_rviz', default_value='false'),
            DeclareLaunchArgument('onnx_model_path', default_value=''),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(wb_py),
                launch_arguments={
                    'world_file': LaunchConfiguration('world_file'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                }.items(),
            ),
            IncludeLaunchDescription(PythonLaunchDescriptionSource(vb_py)),
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
            Node(
                package='endendend_core',
                executable='relay_chain_publisher',
                name='relay_chain_publisher',
                output='screen',
            ),
            OpaqueFunction(function=_drone_fleet),
            Node(
                package='rviz2',
                executable='rviz2',
                name='track2_rviz',
                arguments=['-d', rviz_cfg],
                condition=IfCondition(LaunchConfiguration('enable_rviz')),
                output='screen',
            ),
        ]
    )
