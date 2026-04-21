#!/usr/bin/env python3
"""Per-drone YASMIN observability + controller (FSM thread disabled on controller when FSM node runs)."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0'),
            DeclareLaunchArgument('initial_depth', default_value='0.0'),
            DeclareLaunchArgument('vertex_port', default_value='19790'),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            DeclareLaunchArgument('use_potential_cmd', default_value='false'),
            DeclareLaunchArgument(
                'use_safety_layer',
                default_value='false',
                description='Publish cmd_vel_raw; safety_watchdog muxes to cmd_vel',
            ),
            Node(
                package='endendend_core',
                executable='vertex_swarm_fsm',
                name='swarm_fsm',
                parameters=[
                    {
                        'heartbeat_interval': ParameterValue(
                            LaunchConfiguration('heartbeat_interval'), value_type=float
                        ),
                        'election_timeout': ParameterValue(
                            LaunchConfiguration('election_timeout'), value_type=float
                        ),
                    }
                ],
                output='screen',
            ),
            Node(
                package='endendend_drone',
                executable='drone_controller',
                name='controller',
                parameters=[
                    {
                        'drone_id': ParameterValue(LaunchConfiguration('drone_id'), value_type=int),
                        'initial_depth': ParameterValue(LaunchConfiguration('initial_depth'), value_type=float),
                        'vertex_peer_port': ParameterValue(LaunchConfiguration('vertex_port'), value_type=int),
                        'enable_yasmin_thread': False,
                        'use_potential_cmd': ParameterValue(
                            LaunchConfiguration('use_potential_cmd'), value_type=bool
                        ),
                        'use_safety_layer': ParameterValue(
                            LaunchConfiguration('use_safety_layer'), value_type=bool
                        ),
                    }
                ],
                output='screen',
            ),
        ]
    )
