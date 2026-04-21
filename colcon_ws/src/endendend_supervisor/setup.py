from setuptools import find_packages, setup

package_name = 'endendend_supervisor'

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
    description='Supervisor node for swarm global state and failure injection.',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'failure_injector = endendend_supervisor.supervisor_node:main',
            'webots_supervisor = endendend_supervisor.supervisor_node:main',
            'network_emulator = endendend_supervisor.network_emulator:main',
        ],
    },
)
