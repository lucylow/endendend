"""Wrapper: forwards common args to ``endendend_launch`` (source ``install/setup.bash`` first)."""

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    pkg = get_package_share_directory('endendend_launch')
    child = os.path.join(pkg, 'launch', 'swarm_launch.py')
    return LaunchDescription(
        [
            DeclareLaunchArgument('num_drones', default_value='5'),
            DeclareLaunchArgument('use_vertex_bridge', default_value='true'),
            DeclareLaunchArgument('use_vertex_p2p', default_value='true'),
            DeclareLaunchArgument('use_per_drone_vision', default_value='true'),
            DeclareLaunchArgument('onnx_model_path', default_value=''),
            DeclareLaunchArgument('launch_webots', default_value='false'),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(child),
                launch_arguments={
                    'num_drones': LaunchConfiguration('num_drones'),
                    'use_vertex_bridge': LaunchConfiguration('use_vertex_bridge'),
                    'use_vertex_p2p': LaunchConfiguration('use_vertex_p2p'),
                    'use_per_drone_vision': LaunchConfiguration('use_per_drone_vision'),
                    'onnx_model_path': LaunchConfiguration('onnx_model_path'),
                    'launch_webots': LaunchConfiguration('launch_webots'),
                }.items(),
            ),
        ]
    )
