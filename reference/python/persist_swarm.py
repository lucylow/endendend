"""Persist last-known swarm view for reintegration after isolation (mirrors demo localStorage)."""
import json
import os

SWARM_STATE_PATH = os.environ.get("SWARM_STATE_PATH", "swarm_state.json")


def save_swarm_state(state: dict) -> None:
    with open(SWARM_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def load_swarm_state() -> dict:
    if os.path.exists(SWARM_STATE_PATH):
        with open(SWARM_STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}
