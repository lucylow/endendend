# Scenarios

## 1. Dynamic Daisy Chain

**Goal:** Maintain connectivity through a tunnel by inserting relay drones.

**Setup:**
- 5 drones start at tunnel entrance
- Explorer advances into tunnel
- Signal degrades with distance

**Expected behavior:**
1. One drone elected as Explorer (deepest depth)
2. As Explorer moves beyond `relay_insertion_distance` (8m) from last relay, a Standby drone is promoted to Relay
3. Chain grows: Base ← Relay₁ ← Relay₂ ← Explorer
4. If a Relay fails, neighbors detect via heartbeat timeout (5s) and re-link

**Config override:** `config/scenarios/daisy_chain.yaml`

---

## 2. Fallen Comrade

**Goal:** Redistribute search sectors when a rover dies.

**Setup:**
- 5 rovers each assigned a grid sector
- After 30s, one rover is killed (scenario event)

**Expected behavior:**
1. Survivors detect missing heartbeat within 5s
2. Dead rover's sector is split among neighbors via gossip
3. Exploration continues with no coverage gaps
4. BFT consensus confirms reallocation (tolerates 1 Byzantine node in 5)

**Config override:** `config/scenarios/fallen_comrade.yaml`

---

## 3. Blind Handoff

**Goal:** Aerial drone detects victim, hands off rescue to ground rover.

**Setup:**
- 2 aerial drones + 3 ground rovers
- Aerial battery drains at 0.01%/s
- Victim at known position

**Expected behavior:**
1. Aerial detects victim within 12m → broadcasts `TARGET_ANNOUNCEMENT`
2. Ground rovers calculate distance, broadcast `TARGET_CLAIM`
3. Closest rover wins (tie-break: lexicographic ID)
4. Winner navigates to victim → broadcasts `TARGET_RESOLVED`
5. Aerial returns to Standby

**Config override:** `config/scenarios/blind_handoff.yaml`

---

## Running Scenarios

```bash
# With Webots
./scripts/run_webots.sh worlds/tunnel.wbt config/scenarios/daisy_chain.yaml

# Headless (Python only)
PYTHONPATH=. python -m swarm.demo_mesh_http

# Frontend scenarios page
# Navigate to /scenarios/search-rescue in the browser
```
