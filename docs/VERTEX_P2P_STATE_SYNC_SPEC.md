# Vertex P2P State Synchronization — Drone Swarms (Track 2)

**Status:** specification (implementation spans `swarm/`, `colcon_ws/`, dashboard P2P store).

Vertex peer-to-peer state sync targets **5+ drones** sharing one **mission-shaped** world model in **blackout** conditions: no ROS master, no cloud broker, no single topic owner. This document is the protocol contract for the Vertex Swarm Challenge **Track 2**, with Webots as the primary integration surface.

**Related repo docs:** [`ARCH.md`](ARCH.md) (runtime map), [`COORD-LOGIC.md`](COORD-LOGIC.md) (FSM), [`swarm-vibe-bft-consensus-prompt.md`](swarm-vibe-bft-consensus-prompt.md) (PBFT mesh gaps and test matrix).

---

## 1. Goals and non-goals

### 1.1 Goals

| Property | Meaning in this track |
| --- | --- |
| **Eventual consistency** | Given periods of connectivity, all honest nodes converge on the same committed **coordination** facts and a **compatible** replicated view of soft state (positions, detections). |
| **Median sync latency** | Time from local write (e.g. pose update) until **≥80%** of live peers have applied the same version vector slot (measured under stated loss/latency). Target **under 100 ms median** at **30%** independent loss (see section 8). |
| **Byzantine tolerance** | Up to **`f = ⌊(n−1)/3⌋`** Byzantine nodes for **BFT-gated** decisions when **`n ≥ 3f + 1`**. For **n = 5**, **`f = 1`**; prepare/commit quorum **`q = ⌊2n/3⌋ + 1 = 4`**. |
| **No SPOF** | No ROS master, no central MQTT broker, no single writer for mission state; FoxMQ/Vertex is **mesh-facing**, not a logical owner of truth. |
| **Partition survival** | Islands progress with local policy; on heal, **deterministic merge** + optional **BFT epoch bump** for role topology. |
| **Solo mode** | A drone with **no valid peers** for **T_solo** continues mission with persisted map/state and keeps advertising (see section 6). |

### 1.2 Non-goals

- **Strong linearizability** for every pose sample (bandwidth and loss make that unrealistic). Pose is **last-writer-wins (LWW)** with a defined clock rule (section 4.4).
- **Cryptographic proof of sensor truth** (thermal/victim): signatures bind **claims**, not physical reality.
- **Guaranteed liveness** under arbitrary adversary + worst-case partition (standard impossibility constraints apply); the spec defines **timeouts**, **retries**, and **safe stall** (no bad commit).

---

## 2. Threat and trust model

- **Network:** adversarial loss, delay, reorder, duplication; occasional partition.
- **Nodes:** up to **`f`** Byzantine; remaining nodes are **honest-but-crash** or honest.
- **Authentication:** **Ed25519** per `node_id` on signed envelopes and on BFT vote lines. No shared long-term symmetric keys between drones.
- **Replay:** accept envelope only if **`(mission_id, signer_id, seq_or_nonce)`** has not been applied before; maintain a **sliding window** of recent nonces **per signer** (e.g. last **W=1024** entries or **Δt=60s** wall clock if GPS/PTP available in sim).
- **Trust score:** monotonic decay on missed heartbeats, e.g. `trust *= 0.9^stale_count` (cap floor); used for **tie-breaks** and **gossip preferential drop**, not as a sole safety gate for **BFT** (BFT uses quorum + digests).

---

## 3. State envelope (`TashiState`)

All replicated coordination fields live in one **protobuf** message, published on **`/swarm/state`** (FoxMQ MQTT-over-Vertex) and optionally bridged to ROS 2 for Webots.

```protobuf
message TashiState {
  uint64 mission_id = 1;
  string scenario = 2;              // e.g. "tunnel_blackout"
  repeated DroneState drones = 3;
  repeated MissionEvent events = 4;
  ConsensusDigest consensus = 5;   // hash of last committed global decision + epoch
  RecoveryState recovery = 6;
  VersionVector versions = 7;
  uint64 timestamp_ns = 8;          // hybrid logical wall (see section 4.4)
  bytes envelope_nonce = 9;         // unique per broadcast hop-set
  Signature envelope_sig = 10;      // signs canonical bytes of 1..9
}

message DroneState {
  string node_id = 1;
  Role role = 2;
  Position pos = 3;
  float battery_pct = 4;
  float trust_score = 5;
  int64 last_heartbeat_ns = 6;
  bool is_stale = 7;
  repeated Capability caps = 8;
  uint64 pose_seq = 11;             // monotonic per node for LWW
}

message VersionVector {
  map<string, uint64> node_versions = 1;  // node_id -> logical seq of *full* state row
}
```

### 3.1 Size and transport

- **Target:** **≤1200 bytes** typical on wire (fits **IPv4 UDP ~1200–1400 B** safe path); if exceeded, implementations **must** split by **`STATE_PULL` keys** (drones slice, events slice), never silently truncate.
- **Heartbeats** may use a **compact** `Heartbeat` message instead of full `TashiState` on a high-rate topic (`/swarm/heartbeat`).

---

## 4. Time, versions, and merge semantics

### 4.1 Version vector

- Each node **`i`** owns **`versions[i]`**; it increments when **any** of these change: role claim, victim event append, topology epoch, or **full-row** drone record replacement policy triggers.
- Receivers track **`V_remote`**; if **`V_remote[i] > V_local[i]`**, schedule **`STATE_PULL`** for the minimal key set that can explain the gap (usually `drones`, `events`).

### 4.2 Lamport / HLC

- Maintain **`L`** Lamport clock: on send, `L = max(L, max_remote_seen)+1`.
- **`timestamp_ns`** in envelopes is **`HLC`**-style packed (upper bits Lamport, lower bits counter) **or** plain Lamport if wall clock absent; **never** assume tight NTP across drones for correctness—only for metrics.

### 4.3 Merge on partition heal (deterministic)

For each **`node_id`** in drones:

1. Prefer the record with **higher `(pose_seq, versions[node_id])`** lexicographically.
2. If tie, prefer **higher `last_heartbeat_ns`** (HLC).
3. If still tie, prefer **lexicographically smaller `node_id`** (avoid oscillation).

For **`MissionEvent`**, use **append-only set union** keyed by **`(origin_id, event_id)`**; conflicts on same key resolved by **higher HLC** then **smaller origin_id** (prevents duplicate victim spam from dominating).

**Explorer / relay conflicts** are **not** resolved only by LWW: they require either **agreed deterministic election** on the merged peer set **or** a **committed `ROLE_COMMIT`** from BFT (section 5).

### 4.4 Consistency tiers

| Tier | Mechanism | Guarantees |
| --- | --- | --- |
| **A — Soft state** | Gossip + `TashiState` LWW | Eventual, bounded divergence under loss |
| **B — Safety / roles** | Vertex-RS / PBFT-style quorum | **Agreement** on committed `(epoch, role_map or patch)` for honest nodes |
| **C — Critical flood** | `SAFETY_STOP` / `ALL_CLEAR` | Halt on authenticated flood; resume only per section 5.3 |

---

## 5. Consensus and coordination

### 5.1 When to run BFT

Run **full BFT** (prepare/commit) for: **role allocation**, **topology epoch** advance, **`ALL_CLEAR` after `SAFETY_STOP`**, and **mission_id** changes. Run **soft sync** for high-rate pose.

**Quorum (n=5, f=1):** **`q = 4`** matching prepares/commits for the same **`(view, seq, digest)`** instance.

Align message fields with [`swarm-vibe-bft-consensus-prompt.md`](swarm-vibe-bft-consensus-prompt.md): every consensus packet carries **`view`**, **`seq`**, **`digest`**, and **`new_view`** on view-change.

### 5.2 Leaderless role scoring (deterministic)

On **`ROLE_ALLOC{task_id, bidder_id, score}`**, honest nodes compute:

`score = 0.3*proximity_norm + 0.3*capability_norm + 0.2*trust + 0.1*battery + 0.1*load_inv`

All norms defined on **[0,1]** with **documented** min/max in sim. **Winner** = max score; ties → **smaller `bidder_id`**. BFT commits **`ROLE_COMMIT{epoch, winner_id, task_id}`**.

### 5.3 Safety broadcast

```text
SAFETY_STOP { reason, originator_id, timestamp_ns, ttl, sig }
ALL_CLEAR    { mission_id, epoch, quorum_cert, sig }
```

- **`SAFETY_STOP`:** authenticated; **flood** with **`TTL=5`**, **`seen`** set by **`msg_id`**. All drones **inhibit motion** on first valid receipt.
- **`ALL_CLEAR`:** motion allowed only after **BFT commit** or **q-of-n** signed bundle matching **`mission_id` + `epoch`** (pick one policy; do not mix).

---

## 6. Discovery, heartbeats, peer table

### 6.1 Multi-channel discovery

| Channel | Mechanism | Interval | Notes |
| --- | --- | --- | --- |
| Broadcast | UDP `255.255.255.255:5353` `DISCOVER` | **5s ± 1s** jitter | **3** retries, exponential backoff |
| Multicast | `239.0.0.1:5353` `ANNOUNCE` | **10s** | Maintains persistent table |
| Gossip | Random `GOSSIP_PEERS` subset | **15s** | **TTL=3**, anti-entropy for peer lists |

**`DISCOVER` → `ANNOUNCE{node_id, depth, caps, udp_ep, foxmq_id}`**. Gossip carries **deduped** neighbor lists for bootstrap.

### 6.2 Peer table

```text
peers: Dict[node_id, {last_seen_ns, depth, rssi, stale_count, caps}]
```

- **Stale:** mark after **3** missed heartbeats using **adaptive timeout** (section 6.3).
- **Persist** peer table + last `TashiState` to disk for **solo recovery** and post-reboot merge.

### 6.3 Adaptive heartbeat

```text
interval = f(worst_peer_loss_est):
  loss > 50% → 5s
  loss < 10% → 1s
  else → 2s
timeout = 3 × interval
```

Payload:

```text
HEARTBEAT { node_id, role, depth, battery, loss_to_peers{}, rtt_ms{}, caps_hash }
```

Piggyback **EWMA** RTT/loss; cap history size per peer.

### 6.4 Solo mode

If **no peer** passes liveness for **`T_solo = 30s`**:

- Switch to **solo explorer** behavior (local planner authority).
- **Persist** local map / victim list / version vector.
- Continue **ANNOUNCE** + optional **beacon** so reunification is fast.

**Exit solo:** after **K=3** consecutive ticks with **≥1** valid peer and merged `TashiState`, rejoin soft sync; **roles** follow **BFT** or deterministic election on merged set.

---

## 7. Reliability over UDP

### 7.1 `ReliableSend` (critical only)

- **`retry=3`**, timeout **`max(250ms, 2×RTT_ewma)`**, exponential backoff.
- Pending map: **`msg_id → {dest, payload, retries_left, deadline}`**.
- **`ACK{msg_id}`** on application-processed receipt.
- **Heartbeats** and **high-rate pose** stay **best-effort** (no ACK storm).

### 7.2 Flooding fallback

If relay **chain** is broken, **critical** messages (`SAFETY_STOP`, `ROLE_COMMIT`, victim **confirmed**) **flood** to all neighbors except sender with **`TTL−1`**, **`seen_set`** loop prevention.

---

## 8. Performance targets and measurement

| Metric | Target | Test condition |
| --- | --- | --- |
| Sync latency (median) | **under 100 ms** | **30%** Bernoulli loss, 50–150 ms RTT |
| Discovery | **under 60 s** | **70%** loss + 500 ms mean delay (jitter 100 ms) |
| Role commit | **under 500 ms** | **f=1** Byzantine or crash, remainder honest |
| Partition heal | **under 10 s** | 30 s split then heal |

**Measurement:**

- **Sync lag:** `max_i(V_self[i] − V_peer[i])` over live peers, sampled every tick.
- **Chain uptime %:** time with a valid explorer **and** connected relay path to base in sim graph.
- **False stale rate:** peers marked stale that receive a valid heartbeat before the liveness timeout expires (should be low with hysteresis).

**Hysteresis:** **5 s grace** before flipping `is_stale` in UI/FSM to avoid flapping under bursty loss.

---

## 9. Webots / ROS 2 integration

### 9.1 Masterless launch

- **`ros2 launch`** spawns **N** `drone_node` processes; discovery via **DDS** participant discovery (unreliable QoS allowed for discovery-only paths).
- **No ROS Master** (ROS 1); in ROS 2, avoid any **single** custom discovery server in the judged config.

### 9.2 Bridge sketch

Bridge **sensors → `DroneState`** and **`TashiState` consensus → role**:

- Read pose from supervisor or GPS; thermal/camera mocked if needed.
- On **`consensus.roles[node_id] ≠ local_role`**, apply **only** after **commit** callback (tier B).

Reference stub: `colcon_ws/src/endendend_core/endendend_core/vertex_p2p_sync.py` (extend toward this spec).

---

## 10. Testing / emulation

Extend **`network_emulator.py`** (or `tc` scripts) with:

```bash
tc qdisc add dev veth1 root netem loss 70% 25% correlation
tc qdisc add dev veth1 netem delay 500ms 100ms distribution normal
```

- **Partitions:** `iptables` DROP between groups; heal by rule removal.
- **Byzantine:** use `ByzantineInjector` patterns in `swarm/vertex_node.py` (see BFT prompt).

**Minimum test cases:** honest 5-node converge; **70%** loss discovery bound; **f=1** equivocating role proposals; partition **A|B** with two explorers then post-heal **single** committed explorer; solo **30s** then merge without duplicate victims.

---

## 11. Implementation roadmap (suggested)

| Week | Deliverable |
| --- | --- |
| 1 | Protobuf + heartbeat + gossip discovery |
| 2 | Version vectors + `STATE_PULL` / `STATE_PUSH` + merge proofs in logs |
| 3 | BFT role pipeline + flood path + `SAFETY_STOP`/`ALL_CLEAR` |
| 4 | Webots bridge + `tc`/pytest harness + dashboard metrics |

---

## 12. Edge cases (explicit)

| Scenario | Expected behavior |
| --- | --- |
| All but one fail | Solo continues; victims/events persisted |
| Symmetric partition | One explorer **per island**; on heal, **BFT epoch** or deterministic merge picks **one** explorer; others **relay** |
| Malicious node | Ignored on digest mismatch; trust decay; never exceeds **f** in quorum |
| Clock skew | **HLC/Lamport** for correctness; wall clock only for metrics |
| Duplicate UDP | Idempotent apply using **`(signer, seq, nonce)`** |
| Oversized state | **Chunked pull**; never partial-apply unknown fields |

---

## 13. Document history

- **v1:** consolidated from Track 2 draft; aligned quorum **`q=4` for n=5, f=1`**; split consistency tiers; fixed merge identifiers; added security/replay detail; linked repo modules.
