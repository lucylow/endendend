from setuptools import setup

package_name = 'tashi_swarm'

setup(
    name=package_name,
    version='0.0.1',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='Swarm coordination for Tashi Swarm',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'swarm_coordinator = tashi_swarm.swarm_coordinator_node:main'
        ],
    },
)
