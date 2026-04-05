import { motion } from "framer-motion";
import { useState } from "react";

type CodeFile = { name: string; purpose: string; code: string };
const backendFiles: CodeFile[] = [
  {
    name: "config.py",
    purpose: "Central configuration constants",
    code: `# config.py
# Configuration parameters for the dynamic relay chain swarm.

# Vertex network settings
VERTEX_DISCOVERY_PORT = 5353
VERTEX_BASE_PORT = 9000

# Drone roles
ROLE_STANDBY = "standby"
ROLE_RELAY = "relay"
ROLE_EXPLORER = "explorer"

# Heartbeat interval (seconds)
HEARTBEAT_INTERVAL = 2.0
HEARTBEAT_TIMEOUT = 5.0

# Role election thresholds
EXPLORER_ELECTION_INTERVAL = 5.0
RELAY_INSERTION_LOSS_THRESHOLD = 0.5
RELAY_INSERTION_DISTANCE_STEP = 10.0

# Network emulation (depth-based)
DEPTH_LOSS_FACTOR = 0.01
DEPTH_LATENCY_FACTOR = 2.0

# Webots simulation parameters
SIMULATION_TIMESTEP = 32
DRONE_MAX_SPEED = 2.0
VICTIM_DETECTION_DISTANCE = 2.0

LOG_LEVEL = "INFO"`,
  },
  {
    name: "vertex_node.py",
    purpose: "Vertex C library wrapper via ctypes",
    code: `# vertex_node.py
import ctypes
import threading
import json
import time
import logging
from typing import Dict, Callable, Any

logger = logging.getLogger(__name__)

class VertexNode:
    """Python wrapper for Vertex C library (libvertex.so)."""

    def __init__(self, node_id: str, port: int,
                 callback: Callable[[str, dict], None] = None):
        self.node_id = node_id
        self.port = port
        self.callback = callback
        self.lib = None
        self.running = False
        self._thread = None
        self._state = {}

    def load_library(self, lib_path="./vertex_lib/libvertex.so"):
        self.lib = ctypes.CDLL(lib_path)
        self.lib.vertex_start.argtypes = [ctypes.c_char_p, ctypes.c_int]
        self.lib.vertex_start.restype = ctypes.c_int
        self.lib.vertex_send.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
        self.lib.vertex_send.restype = ctypes.c_int
        self.lib.vertex_poll.argtypes = [ctypes.c_float]
        self.lib.vertex_poll.restype = ctypes.c_int
        self.lib.vertex_stop.argtypes = []
        self.lib.vertex_stop.restype = None
        logger.info(f"Vertex library loaded from {lib_path}")

    def start(self):
        if not self.lib:
            raise RuntimeError("Library not loaded.")
        ret = self.lib.vertex_start(
            self.node_id.encode(), self.port)
        if ret != 0:
            raise RuntimeError(f"Start failed: {ret}")
        self.running = True
        self._thread = threading.Thread(
            target=self._poll_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        if self.lib:
            self.lib.vertex_stop()

    def send(self, dest: str, payload: dict):
        if not self.running:
            return
        msg = json.dumps(payload).encode()
        self.lib.vertex_send(dest.encode(), msg)

    def broadcast(self, payload: dict):
        for peer in self._state.get("peers", []):
            self.send(peer, payload)

    def _poll_loop(self):
        while self.running:
            self.lib.vertex_poll(0.1)
            time.sleep(0.1)

    def update_state(self, key: str, value: Any):
        self._state[key] = value
        self.broadcast({
            "type": "STATE_UPDATE",
            "key": key, "value": value,
            "node_id": self.node_id,
            "timestamp": time.time()
        })

    def get_state(self, key: str, default=None):
        return self._state.get(key, default)`,
  },
  {
    name: "chain_manager.py",
    purpose: "Relay chain formation, maintenance & repair",
    code: `# chain_manager.py
import time
import logging
from typing import List, Optional
from config import (
    ROLE_STANDBY, ROLE_RELAY, ROLE_EXPLORER,
    HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT,
    RELAY_INSERTION_LOSS_THRESHOLD,
    RELAY_INSERTION_DISTANCE_STEP
)

logger = logging.getLogger(__name__)

class ChainManager:
    def __init__(self, my_id: str, vertex_node):
        self.my_id = my_id
        self.vertex = vertex_node
        self.role = ROLE_STANDBY
        self.depth = 0.0
        self.peers = {}
        self.chain = []
        self.explorer_id = None

    def update_peer(self, peer_id: str, info: dict):
        self.peers[peer_id] = {
            "role": info.get("role"),
            "depth": info.get("depth", 0.0),
            "last_heartbeat": time.time(),
            **info
        }

    def remove_peer(self, peer_id: str):
        if peer_id in self.peers:
            del self.peers[peer_id]
        if peer_id in self.chain:
            self.chain.remove(peer_id)
            self._repair_chain(peer_id)

    def set_role(self, new_role: str):
        if new_role == self.role:
            return
        self.role = new_role
        self.vertex.update_state("role", new_role)
        logger.info(f"{self.my_id} -> {new_role}")
        if new_role == ROLE_EXPLORER:
            self._announce_explorer()

    def set_depth(self, depth: float):
        self.depth = depth
        self.vertex.update_state("depth", depth)
        if self.role != ROLE_EXPLORER:
            if self._find_deepest() == self.my_id:
                self.set_role(ROLE_EXPLORER)
        if self.role == ROLE_EXPLORER:
            self._maintain_relay_chain()

    def _find_deepest(self) -> Optional[str]:
        candidates = [(self.my_id, self.depth)]
        for pid, info in self.peers.items():
            candidates.append(
                (pid, info.get("depth", 0.0)))
        return max(candidates, key=lambda x: x[1])[0]

    def _announce_explorer(self):
        self.vertex.broadcast({
            "type": "ROLE_ANNOUNCE",
            "role": ROLE_EXPLORER,
            "depth": self.depth
        })
        self._rebuild_chain()

    def _rebuild_chain(self):
        candidates = []
        for pid, info in self.peers.items():
            if info.get("role") in (ROLE_RELAY, ROLE_STANDBY):
                candidates.append(
                    (pid, info.get("depth", 0.0)))
        candidates.sort(key=lambda x: x[1])
        self.chain = [pid for pid, _ in candidates]
        if self.my_id in self.chain:
            self.chain.remove(self.my_id)

    def _maintain_relay_chain(self):
        loss = min(0.9, self.depth * 0.01)
        if loss > RELAY_INSERTION_LOSS_THRESHOLD:
            self._insert_relay()

    def _insert_relay(self):
        deepest_relay = None
        deepest_depth = 0.0
        for pid in self.chain:
            d = self.peers.get(pid, {}).get("depth", 0)
            if d > deepest_depth:
                deepest_depth = d
                deepest_relay = pid

        candidates = [
            (pid, info.get("depth", 0.0))
            for pid, info in self.peers.items()
            if info.get("role") == ROLE_STANDBY
            and deepest_depth < info.get("depth", 0) < self.depth
        ]
        if candidates:
            mid = (deepest_depth + self.depth) / 2
            new_relay = min(
                candidates, key=lambda x: abs(x[1] - mid)
            )[0]
            self._assign_relay(new_relay)

    def _assign_relay(self, peer_id: str):
        self.vertex.send(peer_id, {
            "type": "ROLE_REQUEST",
            "requested_role": ROLE_RELAY,
            "requester": self.my_id
        })

    def _repair_chain(self, failed_id: str):
        self._rebuild_chain()

    def handle_message(self, sender: str, msg: dict):
        msg_type = msg.get("type")
        if msg_type == "HEARTBEAT":
            self.update_peer(sender, msg.get("data", {}))
        elif msg_type == "ROLE_ANNOUNCE":
            self.update_peer(sender, {
                "role": msg.get("role"),
                "depth": msg.get("depth")
            })
            if (msg.get("role") == ROLE_EXPLORER
                    and self.role == ROLE_EXPLORER):
                self.set_role(ROLE_STANDBY)
        elif msg_type == "ROLE_REQUEST":
            if (msg.get("requested_role") == ROLE_RELAY
                    and self.role == ROLE_STANDBY):
                self.set_role(ROLE_RELAY)
                self.vertex.send(msg.get("requester"), {
                    "type": "ROLE_ACCEPT",
                    "accepted_role": ROLE_RELAY,
                    "node_id": self.my_id
                })

    def heartbeat_loop(self):
        while True:
            time.sleep(HEARTBEAT_INTERVAL)
            self.vertex.broadcast({
                "type": "HEARTBEAT",
                "data": {
                    "role": self.role,
                    "depth": self.depth,
                    "timestamp": time.time()
                }
            })
            now = time.time()
            for pid, info in list(self.peers.items()):
                if now - info.get(
                    "last_heartbeat", 0
                ) > HEARTBEAT_TIMEOUT:
                    self.remove_peer(pid)`,
  },
  {
    name: "drone_controller.py",
    purpose: "Main Webots controller for each drone",
    code: `# drone_controller.py
import sys
import time
import logging
import threading
from controller import Robot, GPS, Motor, LED
from vertex_node import VertexNode
from chain_manager import ChainManager
from config import *

logger = logging.getLogger(__name__)

class DroneController:
    def __init__(self, node_id: str, port: int):
        self.node_id = node_id
        self.port = port
        self.robot = Robot()
        self.timestep = int(
            self.robot.getBasicTimeStep())

        # Sensors
        self.gps = self.robot.getDevice("gps")
        self.gps.enable(self.timestep)
        self.distance_sensor = self.robot.getDevice(
            "distance_sensor")
        if self.distance_sensor:
            self.distance_sensor.enable(self.timestep)

        # Motors
        self.motors = []
        for i in range(4):
            motor = self.robot.getDevice(f"motor_{i}")
            motor.setPosition(float('inf'))
            motor.setVelocity(0.0)
            self.motors.append(motor)

        self.led = self.robot.getDevice("led")

        # Vertex + Chain
        self.vertex = VertexNode(
            node_id, port, self.on_message)
        self.chain_mgr = ChainManager(
            node_id, self.vertex)
        self.target_velocity = [0.0, 0.0]
        self.depth = 0.0

    def on_message(self, sender, msg):
        self.chain_mgr.handle_message(sender, msg)

    def run(self):
        self.vertex.load_library()
        self.vertex.start()

        threading.Thread(
            target=self.chain_mgr.heartbeat_loop,
            daemon=True).start()

        while self.robot.step(self.timestep) != -1:
            x, y, z = self.gps.getValues()
            self.depth = z
            self.chain_mgr.set_depth(self.depth)

            # LED color by role
            colors = {
                ROLE_EXPLORER: 0x00FF00,
                ROLE_RELAY: 0x0000FF,
                ROLE_STANDBY: 0xFF0000
            }
            if self.led:
                self.led.set(
                    colors.get(self.chain_mgr.role, 0))

            # Movement by role
            if self.chain_mgr.role == ROLE_EXPLORER:
                for m in self.motors:
                    m.setVelocity(DRONE_MAX_SPEED)
                if (self.distance_sensor
                    and self.distance_sensor.getValue()
                        < VICTIM_DETECTION_DISTANCE):
                    self.vertex.broadcast({
                        "type": "FOUND_VICTIM",
                        "position": [x, y, z],
                        "depth": self.depth
                    })
            else:
                for m in self.motors:
                    m.setVelocity(0.0)

def main():
    node_id = sys.argv[2]
    port = VERTEX_BASE_PORT + int(
        node_id.split('_')[1])
    logging.basicConfig(level=LOG_LEVEL)
    DroneController(node_id, port).run()

if __name__ == "__main__":
    main()`,
  },
  {
    name: "network_emulator.py",
    purpose: "tc rules for depth-based signal degradation",
    code: `# network_emulator.py
import subprocess
import time
import threading
from typing import Dict
import config

class NetworkEmulator:
    def __init__(self):
        self.drone_depths: Dict[str, float] = {}
        self.running = True
        self.thread = threading.Thread(
            target=self._update_loop)
        self.thread.start()

    def set_depth(self, drone_id: str, depth: float):
        self.drone_depths[drone_id] = depth
        self._apply_rules(drone_id)

    def _apply_rules(self, drone_id: str):
        depth = self.drone_depths.get(drone_id, 0.0)
        loss = min(0.9, depth * config.DEPTH_LOSS_FACTOR)
        latency_ms = depth * config.DEPTH_LATENCY_FACTOR

        iface = f"veth{drone_id.split('_')[1]}"

        subprocess.run(
            f"tc qdisc del dev {iface} root",
            shell=True, stderr=subprocess.DEVNULL)

        cmd = (
            f"tc qdisc add dev {iface} root netem "
            f"loss {loss*100}% delay {latency_ms}ms"
        )
        subprocess.run(cmd, shell=True)
        print(
            f"{drone_id}: loss={loss*100:.1f}%, "
            f"latency={latency_ms:.1f}ms")

    def _update_loop(self):
        while self.running:
            time.sleep(1.0)
            for did in self.drone_depths:
                self._apply_rules(did)

    def stop(self):
        self.running = False
        self.thread.join()

if __name__ == "__main__":
    import sys
    emu = NetworkEmulator()
    print("Enter 'drone_id depth' to update.")
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        parts = line.split()
        if len(parts) == 2:
            emu.set_depth(parts[0], float(parts[1]))
    emu.stop()`,
  },
  {
    name: "launch.sh",
    purpose: "Start simulation and all drone controllers",
    code: `#!/bin/bash
# launch.sh - Start the swarm simulation

WEBOTS_PATH="/usr/local/webots"
WORLD_FILE="$(pwd)/webots_worlds/tunnel.wbt"
CONTROLLER="drone_controller.py"

# Start network emulator in background
python3 network_emulator.py &

# Launch 5 drones
for i in {1..5}
do
    $WEBOTS_PATH/webots --mode=fast \\
        --stdout --stderr \\
        --controller="$CONTROLLER" \\
        --controller-args="--id drone_$i" \\
        "$WORLD_FILE" &
    sleep 2
done

wait`,
  },
  {
    name: "mock_vertex.py",
    purpose: "UDP-based mock for testing without Vertex lib",
    code: `# mock_vertex.py
import socket
import json
import threading
import time
import logging

logger = logging.getLogger(__name__)

class MockVertexNode:
    def __init__(self, node_id, port):
        self.node_id = node_id
        self.port = port
        self.sock = socket.socket(
            socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(('0.0.0.0', port))
        self.sock.settimeout(0.5)
        self.running = False
        self.callback = None
        self.peers = set()

    def set_callback(self, callback):
        self.callback = callback

    def start(self):
        self.running = True
        threading.Thread(
            target=self._heartbeat_loop,
            daemon=True).start()
        self._receive_loop()

    def _receive_loop(self):
        while self.running:
            try:
                data, addr = self.sock.recvfrom(65535)
                msg = json.loads(data.decode())
                if msg.get('type') == 'DISCOVER':
                    self._send_to(addr[0], addr[1], {
                        'type': 'ANNOUNCE',
                        'node_id': self.node_id
                    })
                elif msg.get('type') == 'ANNOUNCE':
                    self.peers.add(msg['node_id'])
                elif self.callback:
                    self.callback(
                        msg.get('sender', addr[0]), msg)
            except socket.timeout:
                continue
            except Exception as e:
                logger.error(f"Error: {e}")

    def _heartbeat_loop(self):
        while self.running:
            broadcast = ('255.255.255.255', self.port)
            self.sock.sendto(
                json.dumps({'type': 'DISCOVER'}).encode(),
                broadcast)
            time.sleep(5)

    def stop(self):
        self.running = False
        self.sock.close()`,
  },
];

const frontendFiles: CodeFile[] = [
  {
    name: "index.html",
    purpose: "Dashboard HTML structure with canvas, tables & controls",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dynamic Relay Chain | Vertex Swarm Challenge</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/socket.io-client@4.5.4/dist/socket.io.min.js"></script>
</head>
<body>
<div class="container">
    <header>
        <h1>🚁 Dynamic Relay Chain</h1>
        <p>Adaptive P2P Mesh Relaying for Search &amp; Rescue</p>
        <div id="connectionStatus" class="status-badge disconnected">
            Disconnected
        </div>
    </header>

    <div class="dashboard">
        <div class="visualization-panel">
            <h2>Swarm View</h2>
            <canvas id="tunnelCanvas" width="800" height="300"></canvas>
            <div class="legend">
                <span><span class="color-box explorer"></span> Explorer</span>
                <span><span class="color-box relay"></span> Relay</span>
                <span><span class="color-box standby"></span> Standby</span>
            </div>
        </div>

        <div class="info-panel">
            <div class="relay-chain">
                <h3>📡 Relay Chain</h3>
                <ul id="chainList"></ul>
            </div>
            <div class="drone-table">
                <h3>🛸 Drone Status</h3>
                <table id="droneTable">
                    <thead>
                        <tr><th>ID</th><th>Role</th><th>Depth (m)</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="network-stats">
                <h3>📶 Network Metrics</h3>
                <canvas id="lossChart"></canvas>
                <div id="latencyList"></div>
            </div>
            <div class="controls">
                <h3>⚙️ Simulation Control</h3>
                <button id="injectFailureBtn">💥 Inject Relay Failure</button>
                <button id="resetBtn">🔄 Reset Chain</button>
            </div>
        </div>
    </div>
</div>
<script src="script.js"></script>
</body>
</html>`,
  },
  {
    name: "style.css",
    purpose: "Dashboard styling — dark theme, responsive layout",
    code: `/* style.css */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #0a0f1e;
    color: #e0e0e0;
    padding: 20px;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
}

header {
    margin-bottom: 30px;
    text-align: center;
}

header h1 {
    font-size: 2.5rem;
    color: #00ccff;
    text-shadow: 0 0 10px rgba(0,204,255,0.5);
}

.status-badge {
    display: inline-block;
    margin-top: 15px;
    padding: 5px 15px;
    border-radius: 20px;
    background: #2c2f36;
    font-size: 0.9rem;
    font-weight: bold;
}

.status-badge.connected {
    background: #2e7d32;
    color: white;
}

.status-badge.disconnected {
    background: #c62828;
    color: white;
}

.dashboard {
    display: flex;
    gap: 30px;
    flex-wrap: wrap;
}

.visualization-panel {
    flex: 2;
    min-width: 500px;
    background: #11161f;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

#tunnelCanvas {
    background: #0a0f1a;
    border-radius: 8px;
    display: block;
    margin: 0 auto;
    border: 1px solid #2a2f3a;
    width: 100%;
}

.legend {
    margin-top: 15px;
    display: flex;
    gap: 20px;
    justify-content: center;
}

.color-box {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    margin-right: 6px;
    vertical-align: middle;
}

.color-box.explorer { background-color: #4caf50; }
.color-box.relay { background-color: #2196f3; }
.color-box.standby { background-color: #ff9800; }

.info-panel {
    flex: 1;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 25px;
}

.relay-chain, .drone-table, .network-stats, .controls {
    background: #11161f;
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.drone-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
}

.drone-table th, .drone-table td {
    text-align: left;
    padding: 8px 6px;
    border-bottom: 1px solid #2a2f3a;
}

.controls button {
    background: #2c3e66;
    border: none;
    color: white;
    padding: 8px 12px;
    margin-right: 10px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
}

#injectFailureBtn {
    background: #c62828;
}

@media (max-width: 900px) {
    .dashboard { flex-direction: column; }
    .visualization-panel { min-width: auto; }
}`,
  },
  {
    name: "script.js",
    purpose: "Real-time dashboard — WebSocket, canvas rendering, controls",
    code: `// script.js
// Frontend for Dynamic Relay Chain - Real-time dashboard

let socket = null;
let lossChart = null;
let currentData = {
    drones: [],
    chain: [],
    explorerId: null
};

const connectionStatusDiv = document.getElementById('connectionStatus');
const chainListUl = document.getElementById('chainList');
const droneTableBody = document.querySelector('#droneTable tbody');
const tunnelCanvas = document.getElementById('tunnelCanvas');
const injectFailureBtn = document.getElementById('injectFailureBtn');
const resetBtn = document.getElementById('resetBtn');
const latencyListDiv = document.getElementById('latencyList');
let ctx = tunnelCanvas.getContext('2d');

// ---- WebSocket: try several drone gateways; backoff when mesh is down ----
const DRONE_URLS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
];
let droneUrlIndex = 0;
let retryTimer = null;

function showNoSwarm(msg) {
    connectionStatusDiv.textContent = msg || 'No swarm reachable';
    connectionStatusDiv.classList.add('disconnected');
    connectionStatusDiv.classList.remove('connected');
}

function connectToDrone(url) {
    if (socket) socket.disconnect();
    socket = io(url, {
        transports: ['websocket'],
        reconnection: false,
        reconnectionAttempts: 3,
    });

    socket.on('connect', () => {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        droneUrlIndex = 0;
        connectionStatusDiv.textContent = 'Connected → ' + url;
        connectionStatusDiv.classList.add('connected');
        connectionStatusDiv.classList.remove('disconnected');
    });

    socket.on('connect_error', () => {
        console.warn('Failed to connect to', url);
        retryTimer = setTimeout(() => connectToNextDrone(), 5000);
    });

    socket.on('disconnect', () => {
        connectionStatusDiv.textContent = 'Disconnected';
        connectionStatusDiv.classList.add('disconnected');
        connectionStatusDiv.classList.remove('connected');
        retryTimer = setTimeout(() => connectToNextDrone(), 5000);
    });

    socket.on('droneStateUpdate', (data) => {
        updateDashboard(data);
    });
}

function connectToNextDrone() {
    if (droneUrlIndex >= DRONE_URLS.length) {
        showNoSwarm('No swarm reachable — retry in 5s');
        droneUrlIndex = 0;
        retryTimer = setTimeout(() => connectToNextDrone(), 5000);
        return;
    }
    const url = DRONE_URLS[droneUrlIndex++];
    connectToDrone(url);
}

function connectWebSocket() {
    droneUrlIndex = 0;
    connectToNextDrone();
}

// ---- Update UI ----
function updateDashboard(data) {
    currentData = data;
    renderChain();
    renderDroneTable();
    updateNetworkMetrics();
    drawTunnel();
}

function renderChain() {
    chainListUl.innerHTML = '';
    if (!currentData.chain || currentData.chain.length === 0) {
        chainListUl.innerHTML = '<li>No relays active</li>';
        return;
    }
    const entranceItem = document.createElement('li');
    entranceItem.innerHTML = '🏢 Entrance →';
    chainListUl.appendChild(entranceItem);

    currentData.chain.forEach((droneId, i) => {
        const drone = currentData.drones.find(d => d.id === droneId);
        const role = drone ? drone.role : 'unknown';
        const li = document.createElement('li');
        li.innerHTML = \`\${droneId} (\${role})\${
            i < currentData.chain.length - 1 ? ' →' : ''
        }\`;
        chainListUl.appendChild(li);
    });

    if (currentData.explorerId &&
        !currentData.chain.includes(currentData.explorerId)) {
        const item = document.createElement('li');
        item.innerHTML = \`🚀 \${currentData.explorerId} (explorer) → END\`;
        chainListUl.appendChild(item);
    }
}

function renderDroneTable() {
    droneTableBody.innerHTML = '';
    if (!currentData.drones || currentData.drones.length === 0) {
        droneTableBody.innerHTML = '<tr><td colspan="5">No data</td></tr>';
        return;
    }
    currentData.drones.forEach(drone => {
        const row = document.createElement('tr');
        row.innerHTML = \`
            <td>\${drone.id}</td>
            <td>\${drone.role}</td>
            <td>\${drone.depth.toFixed(1)}</td>
            <td>\${drone.status || 'active'}</td>
            <td><button class="kill-btn" data-id="\${drone.id}">
                💀 Kill
            </button></td>
        \`;
        droneTableBody.appendChild(row);
    });

    document.querySelectorAll('.kill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            killDrone(btn.getAttribute('data-id'));
        });
    });
}

function updateNetworkMetrics() {
    if (!currentData.drones) return;
    const labels = currentData.drones.map(d => d.id);
    const lossData = currentData.drones.map(d => (d.loss || 0) * 100);

    if (lossChart) {
        lossChart.data.labels = labels;
        lossChart.data.datasets[0].data = lossData;
        lossChart.update();
    } else {
        const ctxChart = document.getElementById('lossChart').getContext('2d');
        lossChart = new Chart(ctxChart, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Packet Loss (%)',
                    data: lossData,
                    backgroundColor: 'rgba(33, 150, 243, 0.6)',
                    borderColor: '#2196f3',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100,
                         title: { display: true, text: 'Loss (%)' } }
                }
            }
        });
    }

    latencyListDiv.innerHTML = '';
    currentData.drones.forEach(d => {
        const p = document.createElement('p');
        p.textContent = \`\${d.id}: \${(d.latency || 0).toFixed(0)} ms\`;
        latencyListDiv.appendChild(p);
    });
}

// ---- Canvas: Tunnel Visualization ----
function drawTunnel() {
    if (!ctx) return;
    const width = tunnelCanvas.width;
    const height = tunnelCanvas.height;
    ctx.clearRect(0, 0, width, height);

    // Tunnel walls
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 80);
    ctx.lineTo(width - 50, 80);
    ctx.lineTo(width - 50, height - 80);
    ctx.lineTo(50, height - 80);
    ctx.closePath();
    ctx.stroke();

    // Depth axis
    ctx.beginPath();
    ctx.moveTo(50, height / 2);
    ctx.lineTo(width - 50, height / 2);
    ctx.strokeStyle = '#888';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    const maxDepth = Math.max(
        ...currentData.drones.map(d => d.depth), 0.1);

    // Depth ticks
    for (let depth = 0; depth <= maxDepth; depth += 10) {
        const x = 50 + (depth / maxDepth) * (width - 100);
        ctx.beginPath();
        ctx.moveTo(x, height / 2 - 5);
        ctx.lineTo(x, height / 2 + 5);
        ctx.stroke();
        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.fillText(depth + 'm', x - 8, height / 2 - 8);
    }

    // Draw drones
    currentData.drones.forEach(drone => {
        const x = 50 + (drone.depth / maxDepth) * (width - 100);
        const y = height / 2;

        let color;
        if (drone.role === 'explorer') color = '#4caf50';
        else if (drone.role === 'relay') color = '#2196f3';
        else color = '#ff9800';

        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(drone.id, x - 12, y - 12);
    });

    // Explorer halo
    const explorer = currentData.drones.find(
        d => d.role === 'explorer');
    if (explorer) {
        const x = 50 + (explorer.depth / maxDepth) * (width - 100);
        ctx.beginPath();
        ctx.arc(x, height / 2, 14, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// ---- Commands ----
function killDrone(droneId) {
    if (socket && socket.connected) {
        socket.emit('killDrone', { droneId });
    }
}

function injectFailure() {
    if (socket && socket.connected) {
        socket.emit('injectFailure');
    }
}

function resetChain() {
    if (socket && socket.connected) {
        socket.emit('resetChain');
    }
}

// ---- Mock Data (no backend fallback) ----
function useMockData() {
    const mockDrones = [
        { id: 'drone_1', role: 'standby',  depth: 0.0,  status: 'active', loss: 0.02, latency: 10 },
        { id: 'drone_2', role: 'relay',    depth: 15.2, status: 'active', loss: 0.15, latency: 30 },
        { id: 'drone_3', role: 'relay',    depth: 32.8, status: 'active', loss: 0.35, latency: 65 },
        { id: 'drone_4', role: 'standby',  depth: 45.0, status: 'active', loss: 0.60, latency: 90 },
        { id: 'drone_5', role: 'explorer', depth: 62.5, status: 'active', loss: 0.85, latency: 125 }
    ];
    const mockChain = ['drone_2', 'drone_3'];
    const explorerId = 'drone_5';

    updateDashboard({
        drones: mockDrones, chain: mockChain, explorerId
    });

    setInterval(() => {
        const updated = mockDrones.map(d => ({
            ...d,
            depth: d.depth + (d.role === 'explorer' ? 0.5 : 0.1),
            loss: Math.min(0.9, (d.depth / 100) * 0.9),
            latency: d.depth * 2
        }));
        updateDashboard({
            drones: updated, chain: mockChain, explorerId
        });
    }, 2000);
}

// ---- Init ----
function init() {
    connectWebSocket();
    setTimeout(() => {
        if (!socket || !socket.connected) {
            console.log('Using mock data (no backend)');
            useMockData();
        }
    }, 3000);
    injectFailureBtn.addEventListener('click', injectFailure);
    resetBtn.addEventListener('click', resetChain);
}

init();`,
  },
];

const improvedFiles: CodeFile[] = [
  {
    name: "config.py",
    purpose: "Centralized config with env overrides & validation",
    code: `# config.py
import os
import logging
from typing import Dict, Any

class Config:
    """Central configuration with validation and
    environment variable override."""

    # Vertex network settings (data plane + shared discovery UDP)
    VERTEX_DISCOVERY_PORT = int(
        os.getenv("VERTEX_DISCOVERY_PORT", 5353))
    VERTEX_BASE_PORT = int(
        os.getenv("VERTEX_BASE_PORT", 9000))
    VERTEX_LIB_PATH = os.getenv(
        "VERTEX_LIB_PATH", "./vertex_lib/libvertex.so")

    # Drone roles
    ROLE_STANDBY = "standby"
    ROLE_RELAY = "relay"
    ROLE_EXPLORER = "explorer"

    # Timing parameters (seconds)
    HEARTBEAT_INTERVAL = float(
        os.getenv("HEARTBEAT_INTERVAL", 2.0))
    HEARTBEAT_TIMEOUT = float(
        os.getenv("HEARTBEAT_TIMEOUT", 5.0))
    ROLE_ELECTION_INTERVAL = float(
        os.getenv("ROLE_ELECTION_INTERVAL", 5.0))
    RELAY_INSERTION_CHECK_INTERVAL = float(
        os.getenv("RELAY_INSERTION_CHECK_INTERVAL", 2.0))

    # Relay insertion thresholds
    RELAY_INSERTION_LOSS_THRESHOLD = float(
        os.getenv("RELAY_INSERTION_LOSS_THRESHOLD", 0.5))
    RELAY_INSERTION_DISTANCE_STEP = float(
        os.getenv("RELAY_INSERTION_DISTANCE_STEP", 10.0))
    MAX_RELAY_CHAIN_LENGTH = int(
        os.getenv("MAX_RELAY_CHAIN_LENGTH", 10))

    # Network emulation
    DEPTH_LOSS_FACTOR = float(
        os.getenv("DEPTH_LOSS_FACTOR", 0.01))
    DEPTH_LATENCY_FACTOR = float(
        os.getenv("DEPTH_LATENCY_FACTOR", 2.0))

    # Webots
    SIMULATION_TIMESTEP = int(
        os.getenv("SIMULATION_TIMESTEP", 32))
    DRONE_MAX_SPEED = float(
        os.getenv("DRONE_MAX_SPEED", 2.0))
    VICTIM_DETECTION_DISTANCE = float(
        os.getenv("VICTIM_DETECTION_DISTANCE", 2.0))

    # Backend server
    BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
    BACKEND_PORT = int(os.getenv("BACKEND_PORT", 3000))

    # Mesh survival — multi-channel discovery
    DISCOVERY_INTERVAL_BASE = float(
        os.getenv("DISCOVERY_INTERVAL_BASE", 5.0))
    DISCOVERY_JITTER_SEC = float(
        os.getenv("DISCOVERY_JITTER_SEC", 1.0))
    DISCOVERY_RETRY_ROUNDS = int(
        os.getenv("DISCOVERY_RETRY_ROUNDS", 3))
    DISCOVERY_RETRY_INITIAL_SEC = float(
        os.getenv("DISCOVERY_RETRY_INITIAL_SEC", 0.5))
    MULTICAST_GROUP = os.getenv(
        "MULTICAST_GROUP", "239.0.0.1")
    GOSSIP_INTERVAL_SEC = float(
        os.getenv("GOSSIP_INTERVAL_SEC", 15.0))
    GOSSIP_MAX_PEERS = int(os.getenv("GOSSIP_MAX_PEERS", 10))
    PEER_DISCOVERY_TTL_SEC = float(
        os.getenv("PEER_DISCOVERY_TTL_SEC", 30.0))

    # Reliable messaging
    RELIABLE_RETRIES = int(os.getenv("RELIABLE_RETRIES", 3))
    RELIABLE_TIMEOUT_SEC = float(
        os.getenv("RELIABLE_TIMEOUT_SEC", 1.0))
    RELIABLE_TIMEOUT_HIGH_LATENCY_SEC = float(
        os.getenv("RELIABLE_TIMEOUT_HIGH_LATENCY_SEC", 2.5))

    # Adaptive heartbeats / peer liveness
    HEARTBEAT_INTERVAL_FAST = float(
        os.getenv("HEARTBEAT_INTERVAL_FAST", 1.0))
    HEARTBEAT_INTERVAL_SLOW = float(
        os.getenv("HEARTBEAT_INTERVAL_SLOW", 5.0))
    HEARTBEAT_TIMEOUT_HIGH_LOSS = float(
        os.getenv("HEARTBEAT_TIMEOUT_HIGH_LOSS", 15.0))
    LINK_STATS_WINDOW_SEC = float(
        os.getenv("LINK_STATS_WINDOW_SEC", 30.0))

    # Versioned state & sync
    STATE_VECTOR_BROADCAST_INTERVAL = float(
        os.getenv("STATE_VECTOR_BROADCAST_INTERVAL", 60.0))

    # Flooding (critical alerts)
    FLOOD_DEFAULT_TTL = int(os.getenv("FLOOD_DEFAULT_TTL", 3))
    FLOOD_DEDUP_TTL_SEC = float(
        os.getenv("FLOOD_DEDUP_TTL_SEC", 60.0))

    # Emulator extras
    NETEM_LOSS_CORRELATION = float(
        os.getenv("NETEM_LOSS_CORRELATION", 0.25))
    PARTITION_PROFILE_PATH = os.getenv(
        "PARTITION_PROFILE_PATH", "")

    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    @classmethod
    def validate(cls):
        assert 0 <= cls.RELAY_INSERTION_LOSS_THRESHOLD <= 1
        assert cls.HEARTBEAT_INTERVAL > 0
        assert cls.SIMULATION_TIMESTEP > 0
        logging.info("Configuration validated")

config = Config()`,
  },
  {
    name: "reliable_sender.py",
    purpose: "UDP best-effort reliable layer: ACKs, retries, timeout sweep",
    code: `# reliable_sender.py
import threading
import time
import logging
from typing import Any, Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class ReliableSender:
    """Best-effort reliability on top of vertex.send with ACK + retries."""

    def __init__(
        self,
        vertex: Any,
        retries: int = 3,
        timeout_sec: float = 1.0,
        timeout_fn: Optional[Callable[[], float]] = None,
    ):
        self.vertex = vertex
        self.retries = retries
        self.timeout_sec = timeout_sec
        self.timeout_fn = timeout_fn
        self.pending: Dict[int, Tuple[str, dict, int, float]] = {}
        self.msg_counter = 0
        self.lock = threading.Lock()

    def _deadline(self) -> float:
        base = self.timeout_fn() if self.timeout_fn else self.timeout_sec
        return time.time() + base

    def send(self, dest: str, payload: dict) -> int:
        with self.lock:
            msg_id = self.msg_counter
            self.msg_counter += 1
            msg = {
                **payload,
                "_msg_id": msg_id,
                "_ack_required": True,
            }
            self.pending[msg_id] = (dest, msg, self.retries, self._deadline())
        self._do_send(dest, msg)
        return msg_id

    def _do_send(self, dest: str, msg: dict):
        self.vertex.send(dest, msg)

    def handle_ack(self, msg_id: int):
        with self.lock:
            if msg_id in self.pending:
                del self.pending[msg_id]

    def check_timeouts(self):
        now = time.time()
        with self.lock:
            for msg_id, (dest, msg, retries, deadline) in list(
                self.pending.items()
            ):
                if now <= deadline:
                    continue
                if retries > 0:
                    self.pending[msg_id] = (
                        dest, msg, retries - 1, self._deadline())
                    self._do_send(dest, msg)
                else:
                    del self.pending[msg_id]
                    logger.warning(
                        "Reliable send exhausted retries "
                        "msg_id=%s dest=%s type=%s",
                        msg_id,
                        dest,
                        msg.get("type"),
                    )`,
  },
  {
    name: "vertex_node.py",
    purpose: "Mesh survival: discovery (broadcast+multicast+gossip), reliable send, flood, versioned state",
    code: `# vertex_node.py
import ctypes
import json
import logging
import random
import socket
import struct
import threading
import time
import queue
from typing import Any, Callable, Dict, List, Optional, Set

from config import config
from reliable_sender import ReliableSender

logger = logging.getLogger(__name__)


class VertexNode:
    """Vertex C wrapper + mesh survival: redundant discovery, reliable
    control-plane messages, versioned state, and flood routing."""

    def __init__(
        self,
        node_id: str,
        port: int,
        callback: Optional[Callable[[str, dict], None]] = None,
    ):
        self.node_id = node_id
        self.port = port
        self.callback = callback
        self.lib = None
        self.running = False
        self._thread = None
        self._message_queue = queue.Queue()
        self._state: Dict[str, Any] = {}
        self._peers: Dict[str, Dict] = {}
        self._lock = threading.Lock()
        self._disc_sock: Optional[socket.socket] = None
        self._disc_thread: Optional[threading.Thread] = None
        self._gossip_thread: Optional[threading.Thread] = None
        self._reliable_thread: Optional[threading.Thread] = None
        self._state_vec_thread: Optional[threading.Thread] = None
        self._discovery_seq = 0
        self._seen_announce: Dict[str, int] = {}
        self._flood_seq = 0
        self._flood_seen: Dict[str, float] = {}
        self._last_rtt_proxy = 0.05
        self.reliable = ReliableSender(
            self,
            retries=config.RELIABLE_RETRIES,
            timeout_sec=config.RELIABLE_TIMEOUT_SEC,
            timeout_fn=self._reliable_timeout_for_network,
        )

    def _reliable_timeout_for_network(self) -> float:
        if self._last_rtt_proxy > 0.25:
            return config.RELIABLE_TIMEOUT_HIGH_LATENCY_SEC
        return config.RELIABLE_TIMEOUT_SEC

    def load_library(self, lib_path: str):
        try:
            self.lib = ctypes.CDLL(lib_path)
            self.lib.vertex_start.argtypes = [
                ctypes.c_char_p,
                ctypes.c_int,
            ]
            self.lib.vertex_start.restype = ctypes.c_int
            self.lib.vertex_send.argtypes = [
                ctypes.c_char_p,
                ctypes.c_char_p,
            ]
            self.lib.vertex_send.restype = ctypes.c_int
            self.lib.vertex_poll.argtypes = [ctypes.c_float]
            self.lib.vertex_poll.restype = ctypes.c_int
            self.lib.vertex_stop.argtypes = []
            self.lib.vertex_stop.restype = None
            logger.info("Library loaded from %s", lib_path)
        except Exception as e:
            logger.error("Failed to load library: %s", e)
            raise

    def start(self):
        if not self.lib:
            raise RuntimeError("Library not loaded")
        ret = self.lib.vertex_start(
            self.node_id.encode(), self.port)
        if ret != 0:
            raise RuntimeError("Start failed: %s" % ret)
        self.running = True
        self._thread = threading.Thread(
            target=self._poll_loop, daemon=True)
        self._thread.start()
        self._start_discovery_socket()
        self._disc_thread = threading.Thread(
            target=self._discovery_loop, daemon=True)
        self._disc_thread.start()
        self._gossip_thread = threading.Thread(
            target=self._gossip_loop, daemon=True)
        self._gossip_thread.start()
        self._reliable_thread = threading.Thread(
            target=self._reliable_tick_loop, daemon=True)
        self._reliable_thread.start()
        self._state_vec_thread = threading.Thread(
            target=self._state_vector_loop, daemon=True)
        self._state_vec_thread.start()
        logger.info("Node %s started port=%s", self.node_id, self.port)

    def _start_discovery_socket(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        except (AttributeError, OSError):
            pass
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.bind(("", config.VERTEX_DISCOVERY_PORT))
        s.settimeout(0.5)
        mreq = struct.pack(
            "4s4s",
            socket.inet_aton(config.MULTICAST_GROUP),
            socket.inet_aton("0.0.0.0"),
        )
        s.setsockopt(
            socket.IPPROTO_IP,
            socket.IP_ADD_MEMBERSHIP,
            mreq,
        )
        self._disc_sock = s

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        if self.lib:
            self.lib.vertex_stop()
        if self._disc_sock:
            try:
                self._disc_sock.close()
            except OSError:
                pass
            self._disc_sock = None

    def send(self, dest: str, payload: dict):
        if not self.running:
            return
        try:
            msg = json.dumps(payload).encode()
            ret = self.lib.vertex_send(dest.encode(), msg)
            if ret != 0:
                logger.error("Send to %s failed: %s", dest, ret)
        except Exception as e:
            logger.error("Send exception: %s", e)

    def send_reliable(self, dest: str, payload: dict) -> int:
        return self.reliable.send(dest, payload)

    def broadcast(self, payload: dict):
        with self._lock:
            peers = list(self._peers.keys())
        for peer in peers:
            self.send(peer, payload)

    def broadcast_reliable(self, payload: dict):
        with self._lock:
            peers = list(self._peers.keys())
        for peer in peers:
            self.send_reliable(peer, dict(payload))

    def flood_critical(self, payload: dict, ttl: Optional[int] = None):
        ttl = ttl if ttl is not None else config.FLOOD_DEFAULT_TTL
        with self._lock:
            self._flood_seq += 1
            flood_id = "%s:%s" % (self.node_id, self._flood_seq)
        msg = {
            **payload,
            "_flood": True,
            "_flood_id": flood_id,
            "_flood_ttl": ttl,
        }
        self._fanout_flood(None, msg)

    def _prune_flood_seen(self, now: float):
        cutoff = now - config.FLOOD_DEDUP_TTL_SEC
        dead = [k for k, t in self._flood_seen.items() if t < cutoff]
        for k in dead:
            del self._flood_seen[k]

    def _fanout_flood(self, from_peer: Optional[str], msg: dict):
        now = time.time()
        self._prune_flood_seen(now)
        fid = msg.get("_flood_id")
        if fid:
            if fid in self._flood_seen:
                return
            self._flood_seen[fid] = now
        ttl = int(msg.get("_flood_ttl", 0))
        if self.callback:
            self.callback(from_peer or "flood", dict(msg))
        if ttl <= 1:
            return
        nxt = {**msg, "_flood_ttl": ttl - 1}
        with self._lock:
            peers = list(self._peers.keys())
        for p in peers:
            if p == from_peer:
                continue
            self.send(p, nxt)

    def update_state(self, key: str, value: Any):
        with self._lock:
            ent = self._state.get(key)
            if isinstance(ent, dict) and "version" in ent:
                ver = int(ent["version"]) + 1
            else:
                ver = 1
            self._state[key] = {"value": value, "version": ver}
            vout = ver
        self.broadcast({
            "type": "STATE_UPDATE",
            "key": key,
            "value": value,
            "version": vout,
            "node_id": self.node_id,
            "timestamp": time.time(),
        })

    def get_state(self, key: str, default=None):
        with self._lock:
            ent = self._state.get(key, default)
            if isinstance(ent, dict) and "value" in ent:
                return ent.get("value", default)
            return ent

    def get_state_entry(self, key: str) -> Optional[dict]:
        with self._lock:
            ent = self._state.get(key)
            if isinstance(ent, dict) and "version" in ent:
                return dict(ent)
            return None

    def get_version_vector(self) -> Dict[str, int]:
        with self._lock:
            out: Dict[str, int] = {}
            for k, ent in self._state.items():
                if isinstance(ent, dict) and "version" in ent:
                    out[k] = int(ent["version"])
            return out

    def add_peer(self, peer_id: str, info: dict):
        with self._lock:
            cur = self._peers.get(peer_id, {})
            cur.update(info)
            cur["last_seen"] = time.time()
            self._peers[peer_id] = cur

    def remove_peer(self, peer_id: str):
        with self._lock:
            self._peers.pop(peer_id, None)

    def get_peers(self):
        with self._lock:
            return self._peers.copy()

    def _discovery_loop(self):
        while self.running and self._disc_sock:
            base = config.DISCOVERY_INTERVAL_BASE
            jitter = random.uniform(
                -config.DISCOVERY_JITTER_SEC,
                config.DISCOVERY_JITTER_SEC,
            )
            time.sleep(max(0.5, base + jitter))
            self._discovery_round_with_retries()

    def _discovery_round_with_retries(self):
        wait = config.DISCOVERY_RETRY_INITIAL_SEC
        for round_i in range(config.DISCOVERY_RETRY_ROUNDS):
            self._discovery_seq += 1
            seq = self._discovery_seq
            pkt = json.dumps({
                "type": "DISCOVER",
                "seq": seq,
                "node_id": self.node_id,
            }).encode()
            try:
                self._disc_sock.sendto(
                    pkt,
                    ("255.255.255.255", config.VERTEX_DISCOVERY_PORT),
                )
                self._disc_sock.sendto(
                    pkt,
                    (config.MULTICAST_GROUP, config.VERTEX_DISCOVERY_PORT),
                )
            except OSError as e:
                logger.debug("discovery send: %s", e)
            if round_i < config.DISCOVERY_RETRY_ROUNDS - 1:
                time.sleep(wait)
                wait = min(5.0, wait * 2)

    def _discovery_recv_loop(self):
        while self.running and self._disc_sock:
            try:
                data, addr = self._disc_sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                break
            try:
                msg = json.loads(data.decode())
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            mtype = msg.get("type")
            if mtype == "DISCOVER":
                if msg.get("node_id") == self.node_id:
                    continue
                out = json.dumps({
                    "type": "ANNOUNCE",
                    "node_id": self.node_id,
                    "seq": self._discovery_seq,
                    "ref_seq": msg.get("seq"),
                }).encode()
                try:
                    self._disc_sock.sendto(out, addr)
                except OSError:
                    pass
            elif mtype == "ANNOUNCE":
                pid = msg.get("node_id")
                if not pid or pid == self.node_id:
                    continue
                seq = int(msg.get("seq", 0))
                last = self._seen_announce.get(pid, -1)
                if seq <= last:
                    continue
                self._seen_announce[pid] = seq
                self.add_peer(pid, {"via": "discovery", "addr": addr[0]})

    def _gossip_loop(self):
        while self.running:
            time.sleep(config.GOSSIP_INTERVAL_SEC)
            with self._lock:
                if not self._peers:
                    continue
                keys = [k for k in self._peers if k != self.node_id]
                if not keys:
                    continue
                peer = random.choice(keys)
                peer_list = keys[: config.GOSSIP_MAX_PEERS]
            self.send(peer, {
                "type": "GOSSIP_PEERS",
                "peers": peer_list,
                "source": self.node_id,
            })

    def _reliable_tick_loop(self):
        while self.running:
            time.sleep(0.2)
            self.reliable.check_timeouts()

    def _state_vector_loop(self):
        while self.running:
            time.sleep(config.STATE_VECTOR_BROADCAST_INTERVAL)
            vv = self.get_version_vector()
            self.broadcast({
                "type": "STATE_VECTOR",
                "versions": vv,
                "node_id": self.node_id,
                "timestamp": time.time(),
            })

    def _poll_loop(self):
        if self._disc_sock:
            t = threading.Thread(
                target=self._discovery_recv_loop, daemon=True)
            t.start()
        while self.running:
            try:
                time.sleep(0.05)
            except Exception as e:
                logger.error("Poll error: %s", e)

    def _handle_control_plane(self, sender: str, msg: dict) -> bool:
        mt = msg.get("type")
        if mt == "ACK" and "_msg_id" in msg:
            self.reliable.handle_ack(int(msg["_msg_id"]))
            return True
        if msg.get("_ack_required"):
            mid = msg.get("_msg_id")
            if mid is not None:
                self.send(sender, {"type": "ACK", "_msg_id": mid})
        if mt == "GOSSIP_PEERS":
            for pid in msg.get("peers") or []:
                if pid != self.node_id:
                    self.add_peer(pid, {"via": "gossip"})
            return False
        if mt == "STATE_VECTOR":
            remote = msg.get("versions") or {}
            with self._lock:
                local_vv = {
                    k: int(v.get("version", 0))
                    for k, v in self._state.items()
                    if isinstance(v, dict) and "version" in v
                }
            for key, rv in remote.items():
                lv = local_vv.get(key, 0)
                if rv > lv:
                    self.send(sender, {
                        "type": "STATE_SYNC_REQUEST",
                        "key": key,
                        "version": lv,
                        "node_id": self.node_id,
                    })
            return False
        if mt == "STATE_SYNC_REQUEST":
            key = msg.get("key")
            ent = self.get_state_entry(key)
            if ent:
                self.send(sender, {
                    "type": "STATE_SYNC_RESPONSE",
                    "key": key,
                    "value": ent.get("value"),
                    "version": ent.get("version"),
                    "node_id": self.node_id,
                })
            return True
        if mt == "STATE_SYNC_RESPONSE":
            key = msg.get("key")
            rv = int(msg.get("version", 0))
            with self._lock:
                ent = self._state.get(key)
                lv = int(ent["version"]) if isinstance(ent, dict) else 0
                if rv > lv:
                    self._state[key] = {
                        "value": msg.get("value"),
                        "version": rv,
                    }
            return True
        if mt == "STATE_UPDATE":
            key = msg.get("key")
            if "version" not in msg:
                return False
            rv = int(msg["version"])
            with self._lock:
                ent = self._state.get(key)
                lv = int(ent["version"]) if isinstance(ent, dict) else 0
                if rv > lv:
                    self._state[key] = {
                        "value": msg.get("value"),
                        "version": rv,
                    }
                elif rv < lv:
                    self.send(sender, {
                        "type": "STATE_SYNC_REQUEST",
                        "key": key,
                        "version": rv,
                        "node_id": self.node_id,
                    })
            return False
        if msg.get("_flood") and msg.get("_flood_id"):
            self._fanout_flood(sender, msg)
            return True
        return False

    def ingest_message(self, sender: str, msg: dict):
        """Call from native Vertex receive path."""
        self._on_message_received(sender, msg)

    def _on_message_received(self, sender: str, msg: dict):
        self.add_peer(sender, {"last_seen": time.time()})
        consumed = self._handle_control_plane(sender, msg)
        if consumed:
            return
        if self.callback:
            self.callback(sender, msg)`,
  },
  {
    name: "chain_manager.py",
    purpose: "Mesh survival: reliable control plane, adaptive HB, state sync hooks",
    code: `# chain_manager.py
import time
import logging
import threading
from typing import List, Dict, Optional, Any
from enum import Enum
from config import config

logger = logging.getLogger(__name__)


class DroneRole(Enum):
    STANDBY = "standby"
    RELAY = "relay"
    EXPLORER = "explorer"


class ChainState(Enum):
    FORMING = "forming"
    STABLE = "stable"
    REPAIRING = "repairing"
    DEGRADED = "degraded"


class ChainManager:
    """Relay chain + mesh survival integration: adaptive heartbeats,
    reliable ROLE_/CHAIN messages, and loss-aware peer timeouts."""

    def __init__(self, my_id: str, vertex_node):
        self.my_id = my_id
        self.vertex = vertex_node
        self.role = DroneRole.STANDBY
        self.depth = 0.0
        self.peers: Dict[str, Dict[str, Any]] = {}
        self.chain: List[str] = []
        self.explorer_id: Optional[str] = None
        self.state = ChainState.FORMING

        self.last_election_check = 0.0
        self.last_relay_check = 0.0
        self.packet_loss_estimate = 0.0
        self._stop_heartbeat = threading.Event()
        self._heartbeat_thread = None
        self._last_hb_interval = config.HEARTBEAT_INTERVAL
        self._to_peer_loss: Dict[str, float] = {}
        self._to_peer_last_hb: Dict[str, float] = {}

    def start(self):
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

    def stop(self):
        self._stop_heartbeat.set()
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=2.0)

    def _update_loss_toward_peer(self, peer_id: str):
        now = time.time()
        prev = self._to_peer_last_hb.get(peer_id, 0.0)
        loss = self._to_peer_loss.get(peer_id, 0.0)
        if prev > 0:
            gap = now - prev
            slack = max(self._last_hb_interval, 0.5) * 2.5
            if gap > slack:
                loss = min(1.0, loss * 0.85 + 0.15)
            else:
                loss = max(0.0, loss * 0.9 - 0.02)
        self._to_peer_last_hb[peer_id] = now
        self._to_peer_loss[peer_id] = loss

    def _max_mesh_loss(self) -> float:
        vals = list(self._to_peer_loss.values())
        if not vals:
            return 0.0
        return max(vals)

    def _get_adaptive_interval(self) -> float:
        ml = self._max_mesh_loss()
        if ml > 0.5:
            return config.HEARTBEAT_INTERVAL_SLOW
        if ml < 0.1:
            return config.HEARTBEAT_INTERVAL_FAST
        return config.HEARTBEAT_INTERVAL

    def _peer_timeout_threshold(self) -> float:
        if self._max_mesh_loss() > 0.5:
            return config.HEARTBEAT_TIMEOUT_HIGH_LOSS
        return config.HEARTBEAT_TIMEOUT

    def update_peer(self, peer_id: str, info: dict):
        now = time.time()
        if peer_id not in self.peers:
            self.peers[peer_id] = {}
        self.peers[peer_id].update(info)
        self.peers[peer_id]["last_heartbeat"] = now

    def remove_peer(self, peer_id: str):
        self.peers.pop(peer_id, None)
        self._to_peer_loss.pop(peer_id, None)
        self._to_peer_last_hb.pop(peer_id, None)
        if peer_id in self.chain:
            self.chain.remove(peer_id)
            self._handle_chain_break(peer_id)

    def set_role(self, new_role: DroneRole):
        if new_role == self.role:
            return
        old = self.role
        self.role = new_role
        self.vertex.update_state("role", new_role.value)
        logger.info("%s: %s -> %s", self.my_id, old.value, new_role.value)
        if new_role == DroneRole.EXPLORER:
            self._become_explorer()

    def set_depth(self, depth: float):
        self.depth = depth
        self.vertex.update_state("depth", depth)
        now = time.time()
        if now - self.last_election_check >= config.ROLE_ELECTION_INTERVAL:
            self.last_election_check = now
            self._check_explorer_election()
        if self.role == DroneRole.EXPLORER:
            if now - self.last_relay_check >= config.RELAY_INSERTION_CHECK_INTERVAL:
                self.last_relay_check = now
                self._maintain_relay_chain()

    def handle_message(self, sender: str, msg: dict):
        msg_type = msg.get("type")
        if msg_type == "HEARTBEAT":
            data = dict(msg.get("data") or {})
            self._update_loss_toward_peer(sender)
            rtt_ema = float(data.get("rtt_ms", 0.0) or 0.0)
            if hasattr(self.vertex, "_last_rtt_proxy"):
                self.vertex._last_rtt_proxy = max(
                    0.05, min(2.0, rtt_ema / 1000.0))
            self.update_peer(sender, data)
        elif msg_type == "ROLE_ANNOUNCE":
            role_str = msg.get("role")
            try:
                role = DroneRole(role_str)
            except ValueError:
                return
            self.update_peer(sender, {
                "role": role, "depth": msg.get("depth")})
            if (role == DroneRole.EXPLORER
                    and self.role == DroneRole.EXPLORER
                    and msg.get("depth", 0) > self.depth):
                self.set_role(DroneRole.STANDBY)
        elif msg_type == "ROLE_REQUEST":
            req = msg.get("requested_role")
            try:
                req_role = DroneRole(req)
            except ValueError:
                return
            if (req_role == DroneRole.RELAY
                    and self.role == DroneRole.STANDBY):
                self.set_role(DroneRole.RELAY)
                req_id = msg.get("requester")
                payload = {
                    "type": "ROLE_ACCEPT",
                    "accepted_role": DroneRole.RELAY.value,
                    "node_id": self.my_id,
                }
                if hasattr(self.vertex, "send_reliable"):
                    self.vertex.send_reliable(req_id, payload)
                else:
                    self.vertex.send(req_id, payload)
        elif msg_type == "ROLE_ACCEPT":
            relay_id = msg.get("node_id")
            if relay_id and self.role == DroneRole.EXPLORER:
                self._add_relay_to_chain(relay_id)
        elif msg_type == "CHAIN_UPDATE":
            if self.role != DroneRole.EXPLORER:
                self.chain = list(msg.get("chain") or [])
        elif msg_type == "STATE_UPDATE":
            key = msg.get("key")
            rv = msg.get("version")
            if key and rv is not None and hasattr(self.vertex, "get_state_entry"):
                ent = self.vertex.get_state_entry(key)
                lv = int(ent["version"]) if ent else -1
                if int(rv) > lv:
                    pass
                elif int(rv) < lv:
                    self.vertex.send(sender, {
                        "type": "STATE_SYNC_REQUEST",
                        "key": key,
                        "version": int(rv),
                        "node_id": self.my_id,
                    })
        elif msg_type == "FOUND_VICTIM":
            logger.info(
                "%s heard FOUND_VICTIM (flood) from %s depth=%s",
                self.my_id,
                sender,
                msg.get("depth"),
            )

    def _check_explorer_election(self):
        deepest = self._find_deepest()
        if deepest == self.my_id and self.role != DroneRole.EXPLORER:
            self.set_role(DroneRole.EXPLORER)

    def _find_deepest(self) -> Optional[str]:
        candidates = [(self.my_id, self.depth)]
        for pid, info in self.peers.items():
            candidates.append((pid, info.get("depth", 0.0)))
        return max(candidates, key=lambda x: x[1])[0]

    def _become_explorer(self):
        self.explorer_id = self.my_id
        payload = {
            "type": "ROLE_ANNOUNCE",
            "role": DroneRole.EXPLORER.value,
            "depth": self.depth,
        }
        if hasattr(self.vertex, "broadcast_reliable"):
            self.vertex.broadcast_reliable(payload)
        else:
            self.vertex.broadcast(payload)
        self._rebuild_chain()

    def _rebuild_chain(self):
        candidates = []
        for pid, info in self.peers.items():
            role = info.get("role")
            if role in (DroneRole.RELAY, DroneRole.STANDBY):
                candidates.append(
                    (pid, info.get("depth", 0.0)))
        candidates.sort(key=lambda x: x[1])
        selected = []
        last_d = -float("inf")
        for pid, d in candidates:
            if d - last_d >= config.RELAY_INSERTION_DISTANCE_STEP:
                selected.append(pid)
                last_d = d
                if len(selected) >= config.MAX_RELAY_CHAIN_LENGTH:
                    break
        self.chain = selected
        self._publish_chain()

    def _maintain_relay_chain(self):
        loss = min(0.9, self.depth * config.DEPTH_LOSS_FACTOR)
        self.packet_loss_estimate = loss
        if loss > config.RELAY_INSERTION_LOSS_THRESHOLD:
            self._insert_relay()
        else:
            self._optimize_chain()

    def _insert_relay(self):
        deepest_depth = 0.0
        for rid in self.chain:
            d = self.peers.get(rid, {}).get("depth", 0)
            if d > deepest_depth:
                deepest_depth = d
        candidates = [
            (pid, info.get("depth", 0))
            for pid, info in self.peers.items()
            if info.get("role") == DroneRole.STANDBY
            and deepest_depth < info.get("depth", 0) < self.depth
        ]
        if candidates:
            mid = (deepest_depth + self.depth) / 2
            target = min(
                candidates, key=lambda x: abs(x[1] - mid))
            pl = {
                "type": "ROLE_REQUEST",
                "requested_role": DroneRole.RELAY.value,
                "requester": self.my_id,
            }
            if hasattr(self.vertex, "send_reliable"):
                self.vertex.send_reliable(target[0], pl)
            else:
                self.vertex.send(target[0], pl)

    def _add_relay_to_chain(self, relay_id: str):
        if relay_id in self.chain:
            return
        d = self.peers.get(relay_id, {}).get("depth", 0)
        for i, rid in enumerate(self.chain):
            rd = self.peers.get(rid, {}).get("depth", 0)
            if d < rd:
                self.chain.insert(i, relay_id)
                self._publish_chain()
                return
        self.chain.append(relay_id)
        self._publish_chain()

    def _optimize_chain(self):
        new_chain = []
        last_d = -float("inf")
        for rid in self.chain:
            d = self.peers.get(rid, {}).get("depth", 0)
            if d - last_d >= config.RELAY_INSERTION_DISTANCE_STEP:
                new_chain.append(rid)
                last_d = d
        if new_chain != self.chain:
            self.chain = new_chain
            self._publish_chain()

    def _publish_chain(self):
        self.vertex.update_state("chain", self.chain)
        pl = {"type": "CHAIN_UPDATE", "chain": self.chain}
        if hasattr(self.vertex, "broadcast_reliable"):
            self.vertex.broadcast_reliable(pl)
        else:
            self.vertex.broadcast(pl)

    def _handle_chain_break(self, failed: str):
        self.state = ChainState.REPAIRING
        self._rebuild_chain()
        self.state = ChainState.STABLE

    def _heartbeat_loop(self):
        while not self._stop_heartbeat.is_set():
            interval = self._get_adaptive_interval()
            self._last_hb_interval = interval
            if self._stop_heartbeat.wait(timeout=interval):
                break
            ts = time.time()
            ml = self._max_mesh_loss()
            self.vertex.broadcast({
                "type": "HEARTBEAT",
                "data": {
                    "role": self.role.value,
                    "depth": self.depth,
                    "timestamp": ts,
                    "loss_to_me": ml,
                    "rtt_ms": self.depth * config.DEPTH_LATENCY_FACTOR,
                },
            })
            now = time.time()
            limit = self._peer_timeout_threshold()
            for pid, info in list(self.peers.items()):
                if now - info.get("last_heartbeat", 0) > limit:
                    self.remove_peer(pid)`,
  },
  {
    name: "drone_controller.py",
    purpose: "Webots controller with backend telemetry & graceful shutdown",
    code: `# drone_controller.py
import sys
import time
import logging
import threading
from controller import Robot, GPS, Motor, LED
from vertex_node import VertexNode
from chain_manager import ChainManager, DroneRole
from config import config
import socketio

logger = logging.getLogger(__name__)

class DroneController:
    def __init__(self, node_id: str, port: int,
                 backend_url="http://localhost:3000"):
        self.node_id = node_id
        self.port = port
        self.robot = Robot()
        self.timestep = int(
            self.robot.getBasicTimeStep())

        # Sensors
        self.gps = self.robot.getDevice("gps")
        self.gps.enable(self.timestep)
        self.distance_sensor = self.robot.getDevice(
            "distance_sensor")
        if self.distance_sensor:
            self.distance_sensor.enable(self.timestep)

        # Motors
        self.motors = []
        for i in range(4):
            motor = self.robot.getDevice(f"motor_{i}")
            motor.setPosition(float('inf'))
            motor.setVelocity(0.0)
            self.motors.append(motor)

        self.led = self.robot.getDevice("led")

        # Vertex + Chain
        self.vertex = VertexNode(
            node_id, port, self.on_message)
        self.chain_mgr = ChainManager(
            node_id, self.vertex)

        # Backend telemetry
        self.sio = socketio.Client()
        try:
            self.sio.connect(backend_url)
        except Exception as e:
            logger.warning(f"No backend: {e}")

        self.running = True
        self.victim_found = False
        self.depth = 0.0

    def on_message(self, sender, msg):
        self.chain_mgr.handle_message(sender, msg)

    def run(self):
        self.vertex.load_library(config.VERTEX_LIB_PATH)
        self.vertex.start()
        self.chain_mgr.start()

        while self.robot.step(self.timestep) != -1:
            x, y, z = self.gps.getValues()
            self.depth = z
            self.chain_mgr.set_depth(self.depth)

            # LED by role
            colors = {
                DroneRole.EXPLORER: 0x00FF00,
                DroneRole.RELAY: 0x0000FF,
                DroneRole.STANDBY: 0xFF0000
            }
            if self.led:
                self.led.set(
                    colors.get(self.chain_mgr.role, 0))

            # Movement
            if self.chain_mgr.role == DroneRole.EXPLORER:
                for m in self.motors:
                    m.setVelocity(config.DRONE_MAX_SPEED)
                if (not self.victim_found
                    and self.distance_sensor
                    and self.distance_sensor.getValue()
                        < config.VICTIM_DETECTION_DISTANCE):
                    self.victim_found = True
                    alert = {
                        "type": "FOUND_VICTIM",
                        "position": [x, y, z],
                        "depth": self.depth,
                        "reporter": self.node_id,
                    }
                    if hasattr(self.vertex, "flood_critical"):
                        self.vertex.flood_critical(alert)
                    else:
                        self.vertex.broadcast(alert)
            else:
                for m in self.motors:
                    m.setVelocity(0.0)

            # Telemetry
            self._send_telemetry({
                "depth": self.depth,
                "role": self.chain_mgr.role.value,
                "chain": self.chain_mgr.chain,
                "loss": self.chain_mgr.packet_loss_estimate,
                "latency": self.depth * config.DEPTH_LATENCY_FACTOR
            })

    def _send_telemetry(self, data):
        if self.sio and self.sio.connected:
            try:
                self.sio.emit('drone_telemetry', {
                    'drone_id': self.node_id,
                    'timestamp': time.time(),
                    **data
                })
            except Exception:
                pass

    def stop(self):
        self.running = False
        self.chain_mgr.stop()
        self.vertex.stop()
        if self.sio:
            self.sio.disconnect()

def main():
    node_id = sys.argv[2]
    port = config.VERTEX_BASE_PORT + int(
        node_id.split('_')[1])
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL),
        format=config.LOG_FORMAT)
    ctrl = DroneController(node_id, port)
    try:
        ctrl.run()
    except KeyboardInterrupt:
        ctrl.stop()

if __name__ == "__main__":
    main()`,
  },
  {
    name: "network_emulator.py",
    purpose: "tc netem with burst/correlation, profiles, optional partitions",
    code: `# network_emulator.py
"""Linux tc netem wrapper for mesh survival testing.

Supports correlated/bursty loss, jitter, and optional partition profiles
(JSON) to drop traffic between drone groups. Run standalone:

  python network_emulator.py --profile emulator_profiles/example.json
"""
import argparse
import json
import logging
import os
import random
import subprocess
import threading
import time
from typing import Dict, List, Optional, Set, Tuple

from config import config

logger = logging.getLogger(__name__)


def _iface_for_drone(drone_id: str) -> str:
    idx = drone_id.split("_")[1]
    return "veth%s" % idx


class NetworkEmulator:
    """Depth-driven netem + optional burst/correlation and partitions."""

    def __init__(self, profile_path: Optional[str] = None):
        self.drone_depths: Dict[str, float] = {}
        self.profile: dict = {}
        self.partition_groups: Dict[str, Set[str]] = {}
        self.extra_loss_pct: float = 0.0
        self.jitter_ms: float = 0.0
        self.running = True
        self._lock = threading.Lock()
        if profile_path and os.path.isfile(profile_path):
            self.load_profile(profile_path)
        elif config.PARTITION_PROFILE_PATH and os.path.isfile(
            config.PARTITION_PROFILE_PATH
        ):
            self.load_profile(config.PARTITION_PROFILE_PATH)
        self._thread = threading.Thread(
            target=self._update_loop, daemon=True)
        self._thread.start()

    def load_profile(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            self.profile = json.load(f)
        parts = self.profile.get("partitions") or []
        self.partition_groups = {}
        for i, group in enumerate(parts):
            self.partition_groups["g%s" % i] = set(group)
        logger.info("Loaded emulator profile from %s", path)

    def set_depth(self, drone_id: str, depth: float):
        with self._lock:
            self.drone_depths[drone_id] = depth
        self._apply_rules(drone_id)

    def set_burst_extras(self, extra_loss_pct: float, jitter_ms: float):
        with self._lock:
            self.extra_loss_pct = max(0.0, min(99.0, extra_loss_pct))
            self.jitter_ms = max(0.0, jitter_ms)

    def _partition_loss_boost(self, drone_id: str) -> float:
        boost = 0.0
        for _, members in self.partition_groups.items():
            if drone_id not in members:
                continue
            for other_id, _ in self.drone_depths.items():
                if other_id == drone_id:
                    continue
                if other_id not in members:
                    boost = max(boost, 80.0)
        return boost

    def _netem_cmd(
        self,
        iface: str,
        loss_pct: float,
        latency_ms: float,
    ) -> str:
        corr = max(0.0, min(99.0, config.NETEM_LOSS_CORRELATION))
        loss_pct = max(0.0, min(99.0, loss_pct))
        latency_ms = max(0.0, latency_ms)
        jit = self.jitter_ms
        parts = [
            "tc qdisc add dev %s root netem" % iface,
            "delay %sms %sms distribution normal" % (
                latency_ms,
                max(0.0, jit),
            ),
            "loss %s%% %s%%" % (
                round(loss_pct, 2),
                round(corr, 2),
            ),
        ]
        return " ".join(parts)

    def _apply_rules(self, drone_id: str):
        with self._lock:
            depth = self.drone_depths.get(drone_id, 0.0)
        base = min(90.0, depth * config.DEPTH_LOSS_FACTOR * 100.0)
        base += self.extra_loss_pct
        base += self._partition_loss_boost(drone_id)
        if self.profile.get("drones"):
            ov = self.profile["drones"].get(drone_id, {})
            base = float(ov.get("loss_pct", base))
            latency_ms = float(
                ov.get("latency_ms", depth * config.DEPTH_LATENCY_FACTOR)
            )
        else:
            latency_ms = depth * config.DEPTH_LATENCY_FACTOR
        if random.random() < float(self.profile.get("flutter_chance", 0)):
            base = min(99.0, base + random.uniform(0, 15))
        iface = _iface_for_drone(drone_id)
        subprocess.run(
            "tc qdisc del dev %s root 2>/dev/null" % iface,
            shell=True,
            stderr=subprocess.DEVNULL,
        )
        cmd = self._netem_cmd(iface, base, latency_ms)
        try:
            subprocess.run(cmd, shell=True, check=True)
            logger.debug("%s -> %s", drone_id, cmd)
        except subprocess.CalledProcessError as e:
            logger.error("tc failed for %s: %s", drone_id, e)

    def _update_loop(self):
        while self.running:
            time.sleep(1.0)
            with self._lock:
                ids = list(self.drone_depths.keys())
            for did in ids:
                self._apply_rules(did)

    def inject_partition(self, group_a: List[str], group_b: List[str]):
        self.partition_groups = {
            "a": set(group_a),
            "b": set(group_b),
        }
        logger.warning("Partition injected: %s | %s", group_a, group_b)

    def heal_partitions(self):
        self.partition_groups = {}
        logger.info("Partitions cleared")

    def stop(self):
        self.running = False
        self._thread.join(timeout=2.0)
        for idx in range(1, 10):
            iface = "veth%s" % idx
            subprocess.run(
                "tc qdisc del dev %s root 2>/dev/null" % iface,
                shell=True,
                stderr=subprocess.DEVNULL,
            )
        logger.info("Emulator stopped, rules cleared")


def main():
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(
        description="Mesh survival network emulator (tc netem)",
    )
    parser.add_argument(
        "--profile",
        help="JSON profile path (per-drone loss/latency, partitions)",
    )
    parser.add_argument(
        "--extra-loss",
        type=float,
        default=0.0,
        help="Additional uniform loss %% for all drones",
    )
    args = parser.parse_args()
    emu = NetworkEmulator(profile_path=args.profile)
    emu.set_burst_extras(args.extra_loss, 5.0)
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        emu.stop()


if __name__ == "__main__":
    main()`,
  },
  {
    name: "app.py",
    purpose: "Flask-SocketIO backend server for real-time telemetry",
    code: `# app.py
from flask import Flask
from flask_socketio import SocketIO, emit
import time
import logging
from config import config
from network_emulator import NetworkEmulator

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

drone_states = {}
emulator = NetworkEmulator()

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format=config.LOG_FORMAT)
logger = logging.getLogger(__name__)

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    emit('droneStateUpdate', _get_state_update())

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected")

@socketio.on('killDrone')
def handle_kill_drone(data):
    drone_id = data.get('droneId')
    if drone_id and drone_id in drone_states:
        logger.info(f"Killing {drone_id}")
        del drone_states[drone_id]
        emit('droneStateUpdate',
             _get_state_update(), broadcast=True)

@socketio.on('injectFailure')
def handle_inject_failure():
    logger.info("Injecting relay failure")
    for did, st in drone_states.items():
        if st.get('role') == 'relay':
            handle_kill_drone({'droneId': did})
            break

@socketio.on('resetChain')
def handle_reset_chain():
    logger.info("Resetting chain")
    emit('resetChainCommand', broadcast=True)

@socketio.on('drone_telemetry')
def handle_telemetry(data):
    drone_id = data.get('drone_id')
    if not drone_id:
        return
    drone_states[drone_id] = {
        'id': drone_id,
        'depth': data.get('depth', 0),
        'role': data.get('role', 'standby'),
        'status': 'active',
        'loss': data.get('loss', 0),
        'latency': data.get('latency', 0),
        'timestamp': data.get('timestamp', time.time())
    }
    emulator.set_depth(drone_id, data.get('depth', 0))
    socketio.emit('droneStateUpdate',
                  _get_state_update())

def _get_state_update():
    drones = list(drone_states.values())
    relays = sorted(
        [(d['id'], d['depth']) for d in drones
         if d['role'] == 'relay'],
        key=lambda x: x[1])
    chain = [r[0] for r in relays]
    explorer = next(
        (d['id'] for d in drones
         if d['role'] == 'explorer'), None)
    return {
        'drones': drones,
        'chain': chain,
        'explorerId': explorer
    }

if __name__ == "__main__":
    socketio.run(app,
        host=config.BACKEND_HOST,
        port=config.BACKEND_PORT)`,
  },
  {
    name: "emulator_profiles/example.json",
    purpose: "Sample loss/latency overrides + partition groups for tc emulator",
    code: `{
  "flutter_chance": 0.1,
  "drones": {
    "drone_1": { "loss_pct": 5, "latency_ms": 20 },
    "drone_2": { "loss_pct": 35, "latency_ms": 80 },
    "drone_3": { "loss_pct": 55, "latency_ms": 120 }
  },
  "partitions": [
    ["drone_1", "drone_2"],
    ["drone_3", "drone_4", "drone_5"]
  ]
}`,
  },
  {
    name: "test_reliable_sender.py",
    purpose: "Unit tests for ReliableSender acks, retries, timeouts",
    code: `# tests/test_reliable_sender.py
import time
import unittest

from reliable_sender import ReliableSender


class StubVertex:
    def __init__(self):
        self.out = []

    def send(self, dest, payload):
        self.out.append((dest, payload))


class TestReliableSender(unittest.TestCase):
    def test_ack_clears_pending(self):
        v = StubVertex()
        rs = ReliableSender(v, retries=2, timeout_sec=0.05)
        mid = rs.send("drone_2", {"type": "PING"})
        self.assertEqual(len(rs.pending), 1)
        rs.handle_ack(mid)
        self.assertEqual(len(rs.pending), 0)

    def test_retry_then_drop(self):
        v = StubVertex()
        rs = ReliableSender(v, retries=1, timeout_sec=0.01)
        rs.send("drone_2", {"type": "PING"})
        time.sleep(0.05)
        rs.check_timeouts()
        self.assertGreaterEqual(len(v.out), 2)
        time.sleep(0.05)
        rs.check_timeouts()
        self.assertEqual(len(rs.pending), 0)


if __name__ == "__main__":
    unittest.main()`,
  },
  {
    name: "test_chain_manager.py",
    purpose: "Unit tests for chain manager + mesh survival hooks",
    code: `# tests/test_chain_manager.py
import unittest
import time
from chain_manager import ChainManager, DroneRole, ChainState
from config import config


class MockVertex:
    def __init__(self):
        self.sent = []
        self.state = {}
        self._ver = 0

    def send(self, dest, payload):
        self.sent.append((dest, payload))

    def send_reliable(self, dest, payload):
        msg = {
            **payload,
            "_ack_required": True,
            "_msg_id": len(self.sent),
        }
        self.sent.append((dest, msg))

    def broadcast(self, payload):
        self.sent.append(("broadcast", payload))

    def broadcast_reliable(self, payload):
        self.sent.append(("broadcast_reliable", payload))

    def update_state(self, key, value):
        self._ver += 1
        self.state[key] = {"value": value, "version": self._ver}

    def get_state_entry(self, key):
        return self.state.get(key)


class TestChainManager(unittest.TestCase):

    def setUp(self):
        self.vertex = MockVertex()
        self.mgr = ChainManager("drone_1", self.vertex)

    def test_initial_role(self):
        self.assertEqual(self.mgr.role, DroneRole.STANDBY)
        self.assertEqual(self.mgr.state, ChainState.FORMING)

    def test_set_role_to_explorer(self):
        self.mgr.set_role(DroneRole.EXPLORER)
        self.assertEqual(self.mgr.role, DroneRole.EXPLORER)
        found = any(
            p.get("type") == "ROLE_ANNOUNCE"
            for _, p in self.vertex.sent
            if isinstance(p, dict))
        self.assertTrue(found)

    def test_find_deepest(self):
        self.mgr.peers = {
            "drone_2": {"depth": 10.0},
            "drone_3": {"depth": 20.0},
        }
        self.mgr.depth = 15.0
        self.assertEqual(self.mgr._find_deepest(), "drone_3")

    def test_chain_rebuild(self):
        self.mgr.peers = {
            "drone_2": {
                "role": DroneRole.STANDBY, "depth": 5.0},
            "drone_3": {
                "role": DroneRole.RELAY, "depth": 15.0},
            "drone_4": {
                "role": DroneRole.STANDBY, "depth": 25.0},
        }
        self.mgr._rebuild_chain()
        self.assertEqual(
            self.mgr.chain,
            ["drone_2", "drone_3", "drone_4"])

    def test_relay_insertion_uses_reliable(self):
        self.mgr.role = DroneRole.EXPLORER
        self.mgr.depth = 50.0
        self.mgr.peers = {
            "drone_2": {
                "role": DroneRole.RELAY, "depth": 20.0},
            "drone_3": {
                "role": DroneRole.STANDBY, "depth": 35.0},
        }
        self.mgr.chain = ["drone_2"]
        self.mgr._insert_relay()
        sent_requests = [
            (d, p) for d, p in self.vertex.sent
            if isinstance(p, dict) and p.get("type") == "ROLE_REQUEST"]
        self.assertTrue(len(sent_requests) > 0)
        self.assertTrue(any("_ack_required" in p for _, p in sent_requests))

    def test_adaptive_interval_high_loss(self):
        self.mgr._to_peer_loss["drone_2"] = 0.8
        self.assertEqual(
            self.mgr._get_adaptive_interval(),
            config.HEARTBEAT_INTERVAL_SLOW)

    def test_peer_timeout(self):
        self.mgr.peers["drone_2"] = {
            "last_heartbeat": time.time() - 10}
        self.mgr.remove_peer("drone_2")
        self.assertNotIn("drone_2", self.mgr.peers)


if __name__ == "__main__":
    unittest.main()`,
  },
  {
    name: "requirements.txt",
    purpose: "Python dependencies for the backend",
    code: `flask
flask-socketio
python-socketio
websocket-client`,
  },
];

type Category = "backend" | "frontend" | "improved";

export default function CodeSection() {
  const [activeCategory, setActiveCategory] = useState<Category>("backend");
  const [activeFile, setActiveFile] = useState(0);

  const files = activeCategory === "backend" ? backendFiles : activeCategory === "frontend" ? frontendFiles : improvedFiles;

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setActiveFile(0);
  };

  const categories: { key: Category; label: string }[] = [
    { key: "backend", label: "🐍 Backend (Python)" },
    { key: "frontend", label: "🌐 Frontend (HTML/JS)" },
    { key: "improved", label: "🚀 Improved Backend" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {/* Category toggle */}
      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleCategoryChange(key)}
            className={`font-semibold text-sm px-4 py-2 rounded-lg border transition-colors ${
              activeCategory === key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* File tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {files.map((f, i) => (
          <button
            key={f.name}
            onClick={() => setActiveFile(i)}
            className={`font-mono text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              i === activeFile
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-card/50 text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Purpose */}
      <p className="text-sm text-muted-foreground mb-3 font-mono">
        <span className="text-accent">→</span> {files[activeFile].purpose}
      </p>

      {/* Code block */}
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/80">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-accent/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          <span className="font-mono text-xs text-muted-foreground ml-2">
            {files[activeFile].name}
          </span>
        </div>
        <pre className="p-4 overflow-x-auto max-h-[480px] overflow-y-auto text-xs font-mono text-foreground/80 leading-relaxed">
          {files[activeFile].code}
        </pre>
      </div>
    </motion.div>
  );
}
