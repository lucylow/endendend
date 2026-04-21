from glob import glob
import os
from pathlib import Path

from setuptools import setup

package_name = 'endendend_launch'

_here = Path(__file__).resolve().parent
_world_dir = _here.parents[3] / 'worlds'
_world_files = [
    str(_world_dir / n)
    for n in ('blackout_swarm.wbt', 'blackout_tunnel.wbt')
    if (_world_dir / n).is_file()
]
_world_install: list[tuple[str, list[str]]] = []
if _world_files:
    _world_install = [(os.path.join('share', package_name, 'worlds'), _world_files)]

_cfg_files = glob(os.path.join(_here, 'config', '*'))
_config_install: list[tuple[str, list[str]]] = []
if _cfg_files:
    _config_install = [(os.path.join('share', package_name, 'config'), _cfg_files)]

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob(os.path.join(_here, 'launch', '*.py'))),
        *_world_install,
        *_config_install,
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Lucy Low',
    maintainer_email='lucy@example.com',
    description='Launch files for endendend swarm.',
    license='Apache-2.0',
)
