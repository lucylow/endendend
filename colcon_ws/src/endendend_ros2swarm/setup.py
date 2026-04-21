from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'endendend_ros2swarm'
_here = os.path.abspath(os.path.dirname(__file__))

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob(os.path.join(_here, 'launch', '*.py'))),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='ROS2swarm-style behaviors for endendend Track 2.',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'potential_fields_controller = endendend_ros2swarm.ros2swarm_core.potential_fields_controller:main',
            'relay_chain_behavior = endendend_ros2swarm.behaviors.relay_chain:main',
            'victim_handoff_behavior = endendend_ros2swarm.behaviors.victim_handoff:main',
            'sector_realloc_behavior = endendend_ros2swarm.behaviors.sector_realloc:main',
        ],
    },
)
