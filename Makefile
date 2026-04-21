.PHONY: vision_dataset vision_train vision_demo demo stress test-coord docs clarity vision_sync_public

PYTHON ?= python3

vision_dataset:
	python dataset/gen_dataset.py --out dataset

vision_train: vision_dataset
	python train_yolov8.py

vision_demo: vision_dataset
	@echo "1) colcon build --packages-up-to tashi_vision tashi_msgs (from ros2 workspace)"
	@echo "2) source install/setup.bash"
	@echo "3) ros2 launch tashi_vision vision_swarm.launch.py"
	@echo "4) Webots controllers: add --ros2-vision or set TASHI_ROS2_VISION=1"

vision_sync_public:
	@python -c "import shutil, pathlib; s=pathlib.Path('models/victim_yolov8/best.onnx'); d=pathlib.Path('public/models/victim_yolov8'); d.mkdir(parents=True, exist_ok=True); shutil.copy2(s, d/'best.onnx') if s.is_file() else print('skip: no', s)"

# --- Judge / hackathon clarity targets ---
demo:
	docker compose up --build

stress:
	@echo "Tip: raise packet loss inside the swarm container with tc netem, or POST /stress/packet_loss/<pct> on demo/injection_ui.py"
	@echo "Example: curl -X POST http://127.0.0.1:8099/stress/packet_loss/30"

test-coord:
	PYTHONPATH=. $(PYTHON) -m pytest tests/test_state_machine.py tests/golden_scenarios.py -v

docs:
	$(PYTHON) docs/gen_docs.py

clarity: docs test-coord
	@echo "clarity bundle refreshed (docs + coordination pytest)"
