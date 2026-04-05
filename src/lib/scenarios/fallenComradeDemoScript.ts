import type { DaisyChainDemoScript } from "@/lib/scenarios/dynamicDaisyChainDemoScript";

/**
 * Track 2 — “Fallen Comrade”: autonomous sector reallocation when a rover dies.
 * Aligns with Vertex Swarm Challenge narrative: no cloud, P2P-only agreement.
 */
export const FALLEN_COMRADE_DEMO_SCRIPT: DaisyChainDemoScript = {
  promptTitle: 'The “Fallen Comrade” — Autonomous Role Reallocation in a Distributed Search Grid',
  setting:
    "Five rovers divide a known grid into non-overlapping rectangular sectors (e.g. five vertical strips on a 100×100 cell map). " +
    "Each rover explores only inside its bounds, marks cells searched, and shares exploration state through FoxMQ-style gossip. " +
    "The mesh is lossy; heartbeats prove liveness. At a scripted moment, Rover B stops (trap, dead battery, motor fault) — " +
    "its heartbeats cease while the other four remain connected.",
  goal:
    "Detect the loss within a few seconds, then re-negotiate Rover B’s unsearched territory among survivors with no central controller. " +
    "New boundaries must be consistent across peers, fair (equal area split by default), and must not duplicate work: " +
    "cells already in the global explored map stay skipped. The swarm continues the mission under the new assignment.",
  behaviors: [
    "Sector assignment: each rover holds (x_min, x_max, y_min, y_max); optional shared key `sector_assignments` in the distributed store.",
    "Fast failure detection: ChainManager (or peer table) evicts timed-out peers; short heartbeat epoch (e.g. ~3s) trades false positives for demo speed.",
    "Orphan sector: on peer removal, SectorManager removes the dead id and treats its strip as unowned until reallocation commits.",
    "Leaderless proposal: survivors use random backoff (e.g. 0–2s) so one proposer usually wins; deterministic lowest-id rule is an alternative.",
    "Fair split: partition the dead sector along the longer axis into equal-area sub-strips (or proportional to unexplored workload).",
    "Voting: REALLOCATION_PROPOSAL → VOTE_ACCEPT / VOTE_REJECT; majority of survivors commits; retries on timeout or proposer crash.",
    "Apply: SECTOR_UPDATE broadcasts + persist merged assignments; ExplorationManager filters `choose_next_target` with `is_my_cell`.",
    "Concurrent deaths: protocol stays idempotent — each failure triggers another round; multiple orphans can be merged in one proposal.",
  ],
  architecture: [
    { component: "SectorManager", description: "Local + replicated assignments; propose, vote, apply; hooks from Vertex message dispatch." },
    { component: "ChainManager", description: "On heartbeat timeout, delete peer and call sector_manager.handle_peer_death(peer_id)." },
    { component: "ExplorationManager", description: "Next cell only inside current sector; respects global map for deduplication." },
    { component: "VertexNode / DroneController", description: "Wire REALLOCATION_PROPOSAL, votes, SECTOR_UPDATE into SectorManager." },
    { component: "FoxMQ / shared map", description: "`sector_assignments` plus global explored cells — survivors never re-walk committed cells." },
    { component: "Dashboard (optional)", description: "Colored sector rectangles, explored shading, reallocation event log, time-to-recover KPI." },
  ],
  operatorFlow: [
    "Launch five controllers with initial SECTOR_BOUNDS (e.g. strips 0–20, 20–40, … on X).",
    "Confirm each rover explores only inside its strip; global map fills without cross-sector duplication.",
    "Stop Rover B’s process (or cut its RF). Within ~3–5s, peers drop it from the live set.",
    "Watch one survivor broadcast REALLOCATION_PROPOSAL with new bounds for all live ids; others return VOTE_ACCEPT.",
    "After commit, verify four new partitions cover the old union of survivor strips + B’s strip; B’s explored cells remain lit, not revisited.",
    "Optional: kill a second rover; confirm a second reallocation round without manual intervention.",
  ],
  baselineTest: {
    title: "Baseline — single failure, equal split",
    summary:
      "One rover dies mid-mission; remaining four adopt a valid partition of the full grid responsibility within bounded time, without duplicate exploration of known cells.",
    setup: [
      "Grid 100×100 (or project default); NUM_SECTORS = 5; vertical strips from config / swarm/config.py.",
      "Five agents with distinct ids; heartbeats at fixed interval; timeout ≤ 5s for demo.",
      "Logging on at least one peer for proposals, votes, and final sector_assignments.",
    ],
    procedure: [
      "Run until Rover B has explored a visible subset of its strip (partial coverage).",
      "Terminate B; record t0 = last heartbeat.",
      "Measure t1 = first REALLOCATION_PROPOSAL or SECTOR_UPDATE reflecting B’s area absorbed.",
      "Assert every live rover’s sector is axis-aligned, pairwise disjoint except shared edges, and union covers the pre-failure collective responsibility.",
      "Assert no agent selects a next target that is already in the global explored set.",
    ],
    passCriteria: [
      "t1 − t0 within configured heartbeat and voting windows (typically < 10s in lab).",
      "All survivors agree on the same assignment set after gossip settles (eventual consistency).",
      "Exploration continues with non-zero progress in the newly acquired sub-strips.",
    ],
  },
  extendedValidation: [
    {
      title: "False positive vs speed",
      bullets: [
        "Short timeout risks declaring a flaky link dead — document tradeoff; optional SUSPECTED state before EVICTED.",
        "Under 20% random loss, measure spurious reallocations; tune missed-heartbeat count.",
      ],
    },
    {
      title: "Proposer failure mid-round",
      bullets: [
        "Kill the proposer after broadcast; others should time out and a new backoff round elects another proposer.",
        "No peer may apply partial proposals without quorum.",
      ],
    },
    {
      title: "Partition heal (advanced)",
      bullets: [
        "If B was only partitioned, it may return to find its sector taken — re-join flow: fetch sector_assignments, negotiate standby or helper role.",
      ],
    },
    {
      title: "Frontend / Webots",
      bullets: [
        "Open-field world (e.g. open_field.wbt) with six robots in Simulation picker — align camera with sector overlay.",
        "Export reallocation timestamps to mesh_stats or event stream for judges.",
      ],
    },
  ],
  pythonArtifacts: [
    { label: "Open-field proto / sector layout helper", path: "swarm/robot_proto.py" },
    { label: "Role + heartbeat chain (peer timeout hook)", path: "swarm/chain_manager.py" },
    { label: "Gossip exploration map", path: "swarm/exploration.py" },
    { label: "Main loop integration point", path: "swarm/drone_controller.py" },
  ],
};
