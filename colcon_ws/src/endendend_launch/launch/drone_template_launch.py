#!/usr/bin/env python3
"""Single-drone Track 2 template: YASMIN launch + vision stack under ``drone{N}``."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, GroupAction, IncludeLaunchDescription, OpaqueFunction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, TextSubstitution
from launch_ros.actions import PushRosNamespace


def _group(context, *args, **kwargs):
    did = int(LaunchConfiguration('drone_id').perform(context))
    ns = f'drone{did}'
    elaunch = get_package_share_directory('endendend_launch')
    vshare = get_package_share_directory('endendend_vision')
    yasmin_py = os.path.join(elaunch, 'launch', 'yasmin_fsm_launch.py')
    stack_py = os.path.join(vshare, 'launch', 'vision_stack_launch.py')
    return [
        GroupAction(
            [
                PushRosNamespace(TextSubstitution(text=ns)),
                IncludeLaunchDescription(
                    PythonLaunchDescriptionSource(yasmin_py),
                    launch_arguments={
                        'drone_id': str(did),
                        'initial_depth': str(float(did * 2.0)),
                        'vertex_port': str(19790 + did),
                        'heartbeat_interval': LaunchConfiguration('heartbeat_interval').perform(context),
                        'election_timeout': LaunchConfiguration('election_timeout').perform(context),
                    }.items(),
                ),
                IncludeLaunchDescription(
                    PythonLaunchDescriptionSource(stack_py),
                    launch_arguments={
                        'drone_id': str(did),
                        'model_path': LaunchConfiguration('onnx_model_path').perform(context),
                    }.items(),
                ),
            ]
        )
    ]


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            DeclareLaunchArgument('drone_id', default_value='0'),
            DeclareLaunchArgument('onnx_model_path', default_value=''),
            DeclareLaunchArgument('heartbeat_interval', default_value='2.0'),
            DeclareLaunchArgument('election_timeout', default_value='5.0'),
            OpaqueFunction(function=_group),
        ]
    )
