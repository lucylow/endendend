#!/usr/bin/env python3
"""Global Vertex / FoxMQ bridge (ROS 2 ↔ JSON fan-out)."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('foxmq_broker_port', default_value='1883'),
            DeclareLaunchArgument('vertex_discovery_port', default_value='5353'),
            DeclareLaunchArgument('swarm_domain_id', default_value='0'),
            Node(
                package='endendend_core',
                executable='vertex_ros_bridge',
                name='vertex_bridge',
                parameters=[
                    {
                        'foxmq_broker_port': ParameterValue(
                            LaunchConfiguration('foxmq_broker_port'), value_type=int
                        ),
                        'vertex_discovery_port': ParameterValue(
                            LaunchConfiguration('vertex_discovery_port'), value_type=int
                        ),
                        'swarm_domain_id': ParameterValue(
                            LaunchConfiguration('swarm_domain_id'), value_type=int
                        ),
                    }
                ],
                output='screen',
            ),
        ]
    )
