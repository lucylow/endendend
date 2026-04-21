from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description() -> LaunchDescription:
    ns = LaunchConfiguration('namespace')
    return LaunchDescription(
        [
            DeclareLaunchArgument('namespace', default_value='drone0'),
            DeclareLaunchArgument('drone_id', default_value='0'),
            DeclareLaunchArgument('initial_depth', default_value='0.0'),
            Node(
                package='endendend_drone',
                executable='drone_controller',
                namespace=ns,
                name='controller',
                parameters=[
                    {
                        'drone_id': ParameterValue(LaunchConfiguration('drone_id'), value_type=int),
                        'initial_depth': ParameterValue(
                            LaunchConfiguration('initial_depth'), value_type=float
                        ),
                    }
                ],
            ),
        ]
    )
