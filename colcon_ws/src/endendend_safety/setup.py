import os
from glob import glob

from setuptools import find_packages, setup

package_name = 'endendend_safety'
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
    description='Safety watchdog and monitors for endendend swarm.',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'safety_watchdog = endendend_safety.safety_watchdog:main',
            'geofence_monitor = endendend_safety.geofence_monitor:main',
            'bms_monitor = endendend_safety.bms_monitor:main',
            'collision_avoid = endendend_safety.collision_avoid:main',
            'swarm_safety = endendend_safety.swarm_safety:main',
            'hardware_mock = endendend_safety.hardware_mock:main',
            'estop_recovery = endendend_safety.estop_recovery:main',
        ],
    },
)
