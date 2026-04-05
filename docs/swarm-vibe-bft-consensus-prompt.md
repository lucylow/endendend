# SWARM — Vibe Coding Prompt: Byzantine Fault Tolerance

**Achieving unbreakable consensus in a swarm** (PBFT-style agreement, view changes, fault injection, and observability).

---

## 1. Introduction

Your swarm is a resilient, low-latency mesh with distributed state and real-time coordination. The stress test for robustness is **Byzantine Fault Tolerance (BFT)**: the system should remain safe (honest nodes agree on the same committed decision) when up to **`f`** nodes are arbitrary—lying, equivocating, or selectively silent—provided **`n ≥ 3f + 1`** and you use a suitable protocol and authenticated messages.

In a centralized controller, one compromise can ground the fleet. In a BFT swarm, **no single node’s word is final**; decisions are committed only after quorum agreement, and **liveness** is recovered by **view change** when the primary is suspected faulty.

This prompt guides you to:

- Ground the theory: PBFT phases, quorums, primary rotation, view change.
- Implement or extend a **distributed** consensus engine on top of **Vertex** (or align a simulation layer with the same invariants).
- Integrate BFT into **global decisions**: explorer election, relay insertion, task acceptance, role hand-off.
- Use **Byzantine fault injection** to validate behavior under attack, not only packet loss.
- **Measure and visualize** rounds, view changes, and latency.

**Outcome:** With `n = 3f + 1`, tolerate up to `f` Byzantine nodes for safety; pair with timeouts and view change for liveness when the primary is bad.

---

## 2. Map to this repository (Vertex Swarm)

Use this table so the prompt matches code you already have:

| Concern | Location | Notes |
|--------|----------|--------|
| PBFT + view rotation + ordered log | `swarm/bft_pbft.py` (`PBFTCluster`, `order`, `order_fast`, `consensus_task_winner`) | Synchronous, in-process scheduler—ideal for **tests and reasoning**; not yet a full mesh protocol. |
| Vertex proposals / votes | `swarm/coordination/consensus_engine.py` (`ConsensusEngine`) | Broadcast proposals and votes; optional `pbft` hook. |
| Coordinator glue | `swarm/coordination/swarm_coordinator.py` (`SwarmCoordinator`) | Heartbeats + vote aggregation. |
| Outbound message faults | `swarm/byzantine.py` (`ByzantineInjector`, `byzantine_config.json`) | Drop/corrupt on send. |
| Chain / roles | `swarm/chain_manager.py` (`ChainManager`, `DroneRole`) | Extend here when election results commit. |
| Tests | `swarm/tests/test_bft_pbft.py` | Quorum, view change until honest primary, task winner with Byzantine bidder. |
| Dashboard simulation + UI | `src/store/swarmStore.ts`, `src/components/BFTConsensusPanel.tsx` | Simulated phases, view change retries, fault sliders. |

**Gap (the real build):** Wire **networked** PRE-PREPARE / PREPARE / COMMIT / VIEW-CHANGE / NEW-VIEW messages through `VertexNode`, with **per-view sequence numbers**, **digest checks**, and (in production) **cryptographic authentication** so equivocation is detectable. The Python `PBFTCluster` proves **policy** (quorum, view advance, deterministic task winner); your job is to make that policy **distributed**.

---

## 3. Theory essentials

### 3.1 Quorum

For `n` replicas, use:

\[
q = \left\lfloor \frac{2n}{3} \right\rfloor + 1
\]

When `n = 3f + 1`, this equals **`2f + 1`**. The prompt and dashboard both use this form.

### 3.2 Primary

Fix a **total order of node ids** (e.g. sorted strings). For view `v`, primary is:

`primary(v) = node_ids[v mod n]`

(Using `v % n` on **unordered** ids causes split-brain across processes—always use the **same** ordering everywhere.)

### 3.3 Phases (sketch)

1. **Pre-prepare** (primary): `(view, seq, digest of request)`.
2. **Prepare**: replicas accept only if message matches expected primary and digest; broadcast prepare.
3. **Commit**: after `q` matching prepares, broadcast commit; execute after `q` commits.

### 3.4 View change (intuition)

- If timers fire or messages are inconsistent, replicas **stop trusting the current primary**.
- Each replica sends **VIEW-CHANGE** for a **new view** `v' > v` (not “for the old view only”—messages must be indexed by the **target** view you want to enter).
- Collect **`2f + 1`** VIEW-CHANGE messages for the same `v'`.
- The **primary of `v'`** issues **NEW-VIEW** with a proof set (the collected messages and the minimal prepared certificate needed to preserve safety).
- After NEW-VIEW, replicas enter `v'`, replay state transfer rules, and continue.

**Pedagogical pitfall:** Broadcasting VIEW-CHANGE keyed only to `current_view` without a **declared `new_view`** (or without collecting `2f+1` for that target) does not match PBFT and breaks liveness proofs. The sample sketch in older drafts mixed `view` and `next_view`; fix that before implementing.

---

## 4. Design goals

1. **Safety:** Honest nodes never commit different values for the same `(view, seq)`.
2. **Liveness:** If the primary is faulty or partitioned, **eventually** a new view makes progress (bounded retries or exponential backoff in practice).
3. **Efficiency:** Run full BFT only for **global** or **safety-critical** decisions; keep local control loops cheap.
4. **Testability:** Deterministic faults (crash, omit, corrupt, equivocate, delay) and reproducible seeds.
5. **Demonstrability:** UI shows view, primary, rounds, faults, latency (see `BFTConsensusPanel` pattern).

---

## 5. Step-by-step implementation

### 5.1 Distributed `BFTEngine` (mesh) — contract

Whether you name it `BFTEngine` or extend `ConsensusEngine`, each node should:

- Track `view`, `primary`, `next_seq` (per view), and per-instance state: prepares, commits, digest, status.
- Tag **every** consensus message with `view` (ignore stale views; buffer or trigger view change for higher views per your policy).
- On instance timeout: **`start_view_change(new_view)`** where `new_view = view + 1` (or jump policy if you implement it).
- On `2f+1` VIEW-CHANGE for `v'`: eligible node broadcasts NEW-VIEW; on accept, **cancel timers**, update `view`, and **re-drive** in-progress instances per PBFT state-transfer rules.

**Simplification allowed for Vertex class projects:** single in-flight global instance at a time; still keep `(view, seq)` in messages so you can grow later.

### 5.2 Align with `PBFTCluster` behavior

Mirror these behaviors so tests and sim stay aligned:

- `run_consensus_round`: one attempt at current view.
- `order` / `order_fast`: on failure, `advance_view()` and retry (see `swarm/bft_pbft.py`).
- `consensus_task_winner`: honest replicas only prepare if the proposed value equals **`deterministic_task_winner(bids)`**—so a Byzantine bidder cannot force a non-winner without breaking quorum.

### 5.3 Integration points

| Decision | Suggested value committed | Notes |
|----------|---------------------------|--------|
| Explorer election | Canonical proposal (e.g. `{id, depth, ts}` with deterministic tie-break) | Everyone runs the same tie-break on the **same** candidate set. |
| Relay insertion | Relay id + topology epoch | Explorer-as-primary is policy; BFT still needs view change if that primary is bad. |
| Task acceptance | Winner id from agreed bid set | Same pattern as `consensus_task_winner`. |
| Role hand-off | New role holder id | Short `order_fast` cap if you need fail-fast UX. |

`ChainManager` should apply committed results in one place (handler callback) to avoid divergent local policy.

### 5.4 Byzantine fault injection

**Python mesh:** `ByzantineInjector.transform` in `swarm/vertex_node.py` (already designed for outbound hooks). Extend specs to support **equivocation** (different payloads to different peers) only in test builds.

**Dashboard:** `faultConfig` in `swarmStore` — packet loss, latency, corrupt, delay, Byzantine count; keep **`byzantineNodes ≤ ⌊(n−1)/3⌋`** for meaningful guarantees.

**Engine hook:** `_maybe_byzantine(msg) -> Optional[msg]` before send; types: `drop`, `corrupt`, `delay`, `equivocate` (test-only).

---

## 6. Testing and demonstration

### 6.1 Test 1 — No faults

- `n = 4`, all honest; one consensus round (e.g. explorer id).
- Expect success at view 0; ordered seq increments; latency logged.

### 6.2 Test 2 — One crash (omit)

- One node **drops** all consensus traffic (or never prepares/commits).
- With `f = 1`, `q = 3`, three honest nodes still form a quorum → success.

### 6.3 Test 3 — One malicious replica (not primary)

- Malicious replica sends bad prepares or wrong values; honest nodes use **digest + primary check** and ignore.
- Assert committed value matches deterministic rule (see `test_task_consensus_with_one_byzantine_bidder`).

### 6.4 Test 4 — Primary failure / view change

- Byzantine or silent **primary** at view 0; `order()` should advance view until an honest primary leads a successful round (`test_view_change_until_honest_primary`).

### 6.5 Test 5 — How many faults?

**Important:** With **`n = 4`**, you have **`f = 1`**. You **cannot** guarantee safety and liveness with **two** Byzantine nodes. To tolerate **two** Byzantine nodes you need **`n ≥ 7`** (`3×2+1`).

Use Test 5 to show **graceful degradation**: with too many faults, expect **no commit** or **split detection**, not a wrong commit.

### 6.6 Automation

- Extend `swarm/tests/test_bft_pbft.py` for new policies.
- Optional: headless Webots / multi-process harness sets `BYZANTINE_CONFIG` and scrapes logs for `COMMIT` / `VIEW_CHANGE`.

---

## 7. Frontend and telemetry

- Reuse / extend **`BFTConsensusPanel`**: view, primary, `consensusInstances`, ordered sequence, fault type.
- If the drone controller exposes WebSocket events, add a typed payload e.g. `consensus_update: { view, primary, seq, phase, latencyMs, faultInjected }` so the dashboard matches the mesh.

---

## 8. Conclusion

Full PBFT with **correct view change**, **authenticated messages**, and **deterministic application rules** gives the swarm **Byzantine-grade safety** for global decisions, with **test and UI loops** that prove it under fault injection.

### Final checklist

- [ ] Mesh consensus messages include `view` and `(view, seq)` instance id; stale views rejected.
- [ ] VIEW-CHANGE / NEW-VIEW keyed to a **target view** with `2f+1` quorum; timers drive suspicion.
- [ ] `ChainManager` / coordinator applies **only** committed values.
- [ ] `ByzantineInjector` (and/or test hooks) cover drop, corrupt, delay, and (test) equivocation.
- [ ] Tests cover honest path, one Byzantine replica, Byzantine primary + view change, and over-`f` fault expectations.
- [ ] Dashboard (or WebSocket) shows view, primary, rounds, latency, fault status.
- [ ] Short doc note: **cryptographic signatures** (or HMAC with pairwise keys) required for real adversaries; simulation can omit but must document the gap.

---

*Good luck in the Vertex Swarm Challenge — build consensus you can trust when the mesh lies.*
