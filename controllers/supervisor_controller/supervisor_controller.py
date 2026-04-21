#!/usr/bin/env python3
"""Webots supervisor: failure injection in-sim + optional ROS 2 hooks (rclpy when available).

Services (avoid clashing with ``/supervisor/kill_drone`` ``KillDrone`` on the ROS stack):

- ``/webots_supervisor/kill_drone`` (``std_srvs/srv/Empty``) — teleport a random DEF ``DRONE0``..``DRONE4`` off-world
- ``/webots_supervisor/inject_loss`` (``std_srvs/srv/Empty``) — publish ``0.85`` on ``/supervisor/loss_spike`` for the
  ``network_emulator`` node to consume

Requires Webots Python able to ``import rclpy`` (point Webots to the same interpreter as your ROS 2 overlay), or the
simulation still steps but ROS features are disabled.
"""

from __future__ import annotations

import random
import sys
from typing import Any

try:
    from controller import Supervisor
except ImportError as exc:  # pragma: no cover
    print('Webots ``controller`` module not found:', exc, file=sys.stderr)
    sys.exit(1)

_ROS: Any = None
try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import Float64
    from std_srvs.srv import Empty
except ImportError:
    rclpy = None
    Node = object  # type: ignore[misc, assignment]
    Empty = None  # type: ignore[misc, assignment]
    Float64 = None  # type: ignore[misc, assignment]


class BlackoutWebotsSupervisor(Supervisor):
    def __init__(self) -> None:
        Supervisor.__init__(self)
        self._timestep = int(self.getBasicTimeStep())
        self._ros: Node | None = None
        self._loss_pub = None
        self._drone_defs = [f'DRONE{i}' for i in range(5)]
        if rclpy is not None and Empty is not None:
            if not rclpy.ok():
                rclpy.init(args=sys.argv)
            self._ros = rclpy.create_node('blackout_webots_supervisor')
            self._ros.create_service(Empty, '/webots_supervisor/kill_drone', self._kill_cb)
            self._ros.create_service(Empty, '/webots_supervisor/inject_loss', self._inject_cb)
            if Float64 is not None:
                self._loss_pub = self._ros.create_publisher(Float64, '/supervisor/loss_spike', 10)
            self._ros.get_logger().info(
                'ROS 2 Webots supervisor ready (kill + loss spike). '
                'Use ``ros2 service call /webots_supervisor/kill_drone std_srvs/srv/Empty``'
            )
        else:
            print('blackout_webots_supervisor: rclpy unavailable — stepping without ROS services', file=sys.stderr)

    def _kill_cb(self, _req: Any, resp: Any) -> Any:
        defs = [d for d in self._drone_defs if self.getFromDef(d) is not None]
        if not defs:
            return resp
        name = random.choice(defs)
        target = self.getFromDef(name)
        tr = target.getField('translation')
        if tr is not None:
            tr.setSFVec3f([400.0, 400.0, 400.0])
        if self._ros is not None:
            self._ros.get_logger().warning('Webots kill_drone: teleported %s' % name)
        return resp

    def _inject_cb(self, _req: Any, resp: Any) -> Any:
        if self._loss_pub is not None and Float64 is not None:
            m = Float64()
            m.data = 0.85
            self._loss_pub.publish(m)
        return resp

    def run(self) -> None:
        while self.step(self._timestep) != -1:
            if self._ros is None:
                continue
            if rclpy.ok():
                rclpy.spin_once(self._ros, timeout_sec=0.0)


def main() -> None:
    sup = BlackoutWebotsSupervisor()
    try:
        sup.run()
    except KeyboardInterrupt:
        pass
    finally:
        if sup._ros is not None:
            sup._ros.destroy_node()
        if rclpy is not None and rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
