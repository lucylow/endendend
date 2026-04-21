from setuptools import setup

package_name = 'tashi_core'

setup(
    name=package_name,
    version='0.0.1',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', ['launch/swarm_launch.py']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='Core mission logic for Tashi Swarm',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'mission_manager = tashi_core.mission_manager_node:main'
        ],
    },
)
