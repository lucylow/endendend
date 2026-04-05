"""Per-drone persistent state for restart recovery (role, depth, chain hints)."""
import json
import os

STATE_FILE = os.environ.get("DRONE_STATE_FILE", "drone_state.json")


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}
