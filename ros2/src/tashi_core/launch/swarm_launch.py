from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='tashi_core',
            executable='mission_manager',
            name='mission_manager'
        ),
        Node(
            package='tashi_bridge',
            executable='bridge_node',
            name='tashi_bridge'
        ),
        Node(
            package='tashi_safety',
            executable='safety_node',
            name='safety_monitor'
        ),
        Node(
            package='tashi_swarm',
            executable='swarm_coordinator',
            name='swarm_coordinator'
        ),
        Node(
            package='tashi_sim',
            executable='sim_adapter',
            name='sim_drone_0'
        ),
        Node(
            package='tashi_vision',
            executable='vision_node',
            name='vision_system'
        ),
        Node(
            package='tashi_tools',
            executable='diagnostics',
            name='diagnostics_tool'
        )
    ])
