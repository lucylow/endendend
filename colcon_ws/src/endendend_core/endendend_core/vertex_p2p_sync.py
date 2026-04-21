"""Vertex-style P2P sync stub: optional UDP fan-out + ``/swarm/p2p/ledger`` ROS topic."""

from __future__ import annotations

import socket

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from endendend_core.qos_profiles import SWARM_QOS


class VertexP2pSync(Node):
    def __init__(self) -> None:
        super().__init__('vertex_p2p_sync')
        self.declare_parameter('bind_port', 19790)
        self.declare_parameter('peer_base_port', 19790)
        self.declare_parameter('num_peers', 5)
        self.declare_parameter('enable_udp', False)
        self._port = int(self.get_parameter('bind_port').value)
        self._base = int(self.get_parameter('peer_base_port').value)
        self._n = int(self.get_parameter('num_peers').value)
        self._udp = bool(self.get_parameter('enable_udp').value)
        self._ledger_pub = self.create_publisher(String, '/swarm/p2p/ledger', SWARM_QOS)
        self.create_subscription(String, '/vertex/broadcast', self._ros_in, 10)
        self._sock: socket.socket | None = None
        if self._udp:
            self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                self._sock.bind(('0.0.0.0', self._port))
                self._sock.setblocking(False)
            except OSError as e:
                self.get_logger().warn(f'P2P UDP bind skipped ({self._port}): {e}')
                self._sock = None
            else:
                self.create_timer(0.05, self._drain_udp)
        self.get_logger().info('Vertex P2P sync stub active')

    def _ros_in(self, msg: String) -> None:
        self._ledger_pub.publish(msg)
        if self._sock is not None:
            self._fanout_udp(msg.data)

    def _fanout_udp(self, payload: str) -> None:
        if self._sock is None:
            return
        b = payload.encode('utf-8')
        for i in range(self._n):
            p = self._base + i
            if p == self._port:
                continue
            try:
                self._sock.sendto(b, ('127.0.0.1', p))
            except OSError:
                pass

    def _drain_udp(self) -> None:
        if self._sock is None:
            return
        while True:
            try:
                data, _addr = self._sock.recvfrom(65535)
            except BlockingIOError:
                break
            except OSError:
                break
            out = String()
            out.data = data.decode('utf-8', errors='replace')
            self._ledger_pub.publish(out)

    def destroy_node(self) -> bool:
        if self._sock is not None:
            try:
                self._sock.close()
            except Exception:
                pass
            self._sock = None
        return super().destroy_node()


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = VertexP2pSync()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
