from glob import glob
import os
from pathlib import Path

from setuptools import setup

package_name = 'endendend_launch'

_here = Path(__file__).resolve().parent
_world = _here.parents[3] / 'worlds' / 'blackout_swarm.wbt'
_world_install: list[tuple[str, list[str]]] = []
if _world.is_file():
    _world_install = [(os.path.join('share', package_name, 'worlds'), [str(_world)])]

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob(os.path.join(_here, 'launch', '*.py'))),
        *_world_install,
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='Launch files for endendend swarm.',
    license='Apache-2.0',
)
