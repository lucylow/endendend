# Running Webots worlds

1. From the repository root, open Webots with the **project directory** set to `webots/` (the folder that contains `worlds/` and `controllers/`). Example:

   ```text
   webots webots/worlds/fallen_comrade.wbt
   ```

2. Controllers resolve relative to that project:

   - `scenario_supervisor` — samples `DEF` poses, schedules failures, writes `webots/maps/live_snapshot.json`.
   - `rover_controller` / `aerial_controller` — minimal stepping loops (extend with behaviors).
   - `mission_bridge` — optional `websockets` broadcaster that tails `live_snapshot.json` for a browser.

3. Shared PROTOs live in `webots/worlds/shared/` (`SwarmRobot`, `VictimMarker`, …). Worlds reference them with `EXTERNPROTO "shared/....proto"`.

4. After changing scenario code, regenerate `.wbt` files:

   ```text
   python webots/scripts/generate_worlds.py
   ```

Validate config JSON:

```text
python webots/scripts/validate_maps.py
```
