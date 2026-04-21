from setuptools import find_packages, setup

package_name = 'endendend_core'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='Core QoS, YASMIN FSM, and Vertex bridge for endendend swarm.',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'vertex_ros_bridge = endendend_core.vertex_ros_bridge:main',
            'swarm_state_aggregator = endendend_core.swarm_state_aggregator:main',
            'vertex_p2p_sync = endendend_core.vertex_p2p_sync:main',
        ],
    },
)
