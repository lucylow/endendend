# Replay logs

`ReplayLogger` (see `webots/utils/replay_logger.py`) appends **JSONL** rows with:

- `wall_time`, `sim_time`, `scenario`
- `snapshot` — same structure as `world_snapshot()` in `telemetry_serializer.py`
- `events` — failure injector firings for that step

Start the supervisor with a replay directory:

```text
# In scenario_supervisor controllerArgs, add (manually in .wbt or future flag):
# --replay-dir path/to/dir
```

Summarize a capture:

```text
python webots/scripts/export_replays.py path/to/fallen_comrade_replay.jsonl --out summary.json
```

The frontend can consume either live `live_snapshot.json` (polled) or a `mission_bridge` WebSocket feed.
