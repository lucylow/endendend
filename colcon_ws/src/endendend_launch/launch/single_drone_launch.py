#!/usr/bin/env python3
"""Debug a single namespaced drone (``drone{drone_id}``) with mock peers."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _one(context, *args, **kwargs):
    did = int(LaunchConfiguration('drone_id').perform(context))
    ns = f'drone{did}'
    return [
        Node(
            package='endendend_drone',
            executable='drone_controller',
            namespace=ns,
            name='controller',
            parameters=[
                {
                    'drone_id': did,
                    'initial_depth': float(did * 2.0),
                    'sim_mode': True,
                    'vertex_peer_port': 19790 + did,
                }
            ],
            output='screen',
        )
    ]


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0', description='Numeric id; namespace becomes drone{N}'),
            OpaqueFunction(function=_one),
        ]
    )
