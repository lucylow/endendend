# endendend ROS 2 Humble workspace

Masterless DDS: set `ROS_DOMAIN_ID` consistently across machines. This workspace composes namespaced drone stacks (`drone0` … `droneN-1`), a **swarm state aggregator**, **failure injector** (kill + Vertex election), optional **Vertex P2P sync** stub, **YOLOv8 vision** stack (camera + ONNX detector stubs), and optional **Webots** process.

Packaged launch files live under `endendend_launch/share/.../launch/`. Repository wrappers that forward arguments live in `launch/` at the repo root.

## Build

```bash
cd colcon_ws
source /opt/ros/humble/setup.bash
rosdep install --from-paths src --ignore-src -r -y
colcon build --symlink-install --packages-up-to endendend_launch
source install/setup.bash
```

## Run (installed package)

```bash
ros2 launch endendend_launch swarm_launch.py num_drones:=5
ros2 launch endendend_launch single_drone_launch.py drone_id:=3
ros2 launch endendend_launch webots_supervisor_launch.py launch_webots:=true
ros2 launch endendend_drone drone_launch.py namespace:=drone0
ros2 launch endendend_vision vision_launch.py drone_id:=0 model_path:=/models/best.onnx
```

Failure injection (custom service):

```bash
ros2 service call /supervisor/kill_drone endendend_msgs/srv/KillDrone "{drone_id: 2}"
```

RViz (from repo root, after sourcing overlay if messages are needed):

```bash
rviz2 -d rviz2/swarm.rviz
```

## Docker

From the repository root:

```bash
docker compose -f docker-compose.ros2.yml build ros2-swarm
docker compose -f docker-compose.ros2.yml up ros2-swarm
```

Optional Webots: `docker compose -f docker-compose.ros2.yml --profile sim up` (service `webots-gui`). Optional RViz: add `--profile viz` (requires working X11 / `DISPLAY`).

A second compose path is provided for the hackathon layout: `launch/docker_compose.ros2.yml` (build context is the parent directory of `launch/`).
