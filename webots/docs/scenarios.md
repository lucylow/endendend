# Webots scenario maps

This folder documents the **scenario-first** worlds under `webots/worlds/`. Each track has deterministic geometry (shared seed) and JSON metadata in `webots/maps/` plus `webots/config/` for controllers.

| Scenario | Narrative | Arena | Agents |
|----------|-----------|-------|--------|
| `fallen_comrade` | Sector scan + RoverB failure + reallocation cue | 100×100 m | RoverA–E |
| `blind_handoff` | Aerial sweep, victim zone, low-battery auction cue | 200×200 m | Aerial1, RoverA–C, Victim01 |
| `tunnel_blackout` | Narrow corridor relay + comms degradation | ~16×126 m | RoverA–D |
| `open_track` | Generic SAR / coordination | 180×180 m | RoverA–D |

Regenerate everything after editing Python generators:

```text
python webots/scripts/generate_worlds.py
```

Mirror into the legacy root `worlds/` tree (for existing npm scripts):

```text
python webots/scripts/generate_worlds.py --mirror-root-worlds
```

Track 2 mock telemetry (`worlds/fallen_comrade_track2.wbt` + `fallen_comrade_controller`) is unchanged.
