"""Start mesh stats HTTP server; open swarm/static/mesh_dashboard.html in a browser.

Run from repo root:
  PYTHONPATH=. python swarm/demo_mesh_http.py
"""

from __future__ import annotations

import time

from swarm.network_simulator import NetworkSimulator, start_mesh_stats_http_server


def main() -> None:
    sim = NetworkSimulator("demo")
    sim.set_link("d1", "d2", loss=0.1, latency=0.02)
    sim.set_link("d2", "d1", loss=0.2, latency=0.03)
    start_mesh_stats_http_server(sim, port=8766)
    print("Mesh stats: http://127.0.0.1:8766/mesh_stats")
    print("Open swarm/static/mesh_dashboard.html (file or via static server)")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
