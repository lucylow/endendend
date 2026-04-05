import type { DaisyChainDemoScript } from "@/lib/scenarios/dynamicDaisyChainDemoScript";

/**
 * Track 2 — “Blind Handoff”: air-to-ground rescue coordination with zero cloud dependency.
 * Aligns with Vertex Swarm Challenge 2026 narrative (heterogeneous swarm + P2P negotiation).
 */
export const BLIND_HANDOFF_DEMO_SCRIPT: DaisyChainDemoScript = {
  promptTitle: "The Blind Handoff — Air-to-Ground Rescue Coordination Without a Cloud",
  setting:
    "A mixed swarm searches a large outdoor area: one fast aerial drone (quadcopter) and several slower, heavy ground rovers. " +
    "The aerial unit carries a mocked victim detector; ground units have no upward sensor and depend on the air asset for coordinates. " +
    "The mesh is pure Vertex-style P2P — no central planner, no WAN.",
  goal:
    "When the aerial drone is low on energy and spots a victim, it must not attempt a landing rescue. " +
    "Instead it broadcasts a structured handoff request, collects distance-ranked bids from eligible ground rovers, " +
    "accepts the best bid over unicast, receives an ack, and lets the chosen rover navigate to the victim and broadcast RESCUE_COMPLETE — " +
    "all without any cloud handshake.",
  behaviors: [
    "Battery model: aerial drains faster than ground; below BATTERY_HANDOFF_THRESHOLD the aerial treats new victim sightings as handoff triggers.",
    "Detection: only the aerial runs proximity / mock victim ingestion; ground nodes ignore local victim discovery.",
    "RESCUE_HANDOFF_REQUEST: broadcast handoff_id, victim_location (x,y,z), aerial battery snapshot, bid deadline.",
    "HANDOFF_BID: ground → aerial unicast with bidder id, distance bid, ETA estimate, remaining battery (busy or under-resourced rovers stay silent).",
    "Selection: aerial waits HANDOFF_BID_WINDOW_SEC then picks min bid; ties can use lexicographic node id (same spirit as target claims).",
    "HANDOFF_ACCEPT / HANDOFF_ACK: reliable-style pairing so the winner commits before moving.",
    "Execution: rescuer switches to rescue behavior, drives to RESCUE_ARRIVAL_DISTANCE, then RESCUE_COMPLETE broadcast for swarm-wide victim dedupe.",
    "Aerial continues exploration or return-to-base per policy; rescued keys prevent duplicate handoffs for the same grid-snapped location.",
    "Graceful degradation: no bids → log + optional retry; concurrent handoffs use distinct handoff_id values.",
  ],
  architecture: [
    { component: "swarm/config.py", description: "AERIAL_* / GROUND_* drain, BATTERY_HANDOFF_THRESHOLD, HANDOFF_BID_WINDOW_SEC, bid feasibility constants." },
    { component: "NetworkEmulator.unicast + VertexNode.send", description: "Directed messages for bids, accept, and ack while keeping broadcast for requests and completion." },
    { component: "DroneController", description: "drone_type aerial|ground, battery tick, initiate_handoff, message handlers, handoff rescue branch in _do_rescue." },
    { component: "TargetManager", description: "Unchanged happy path for high-battery aerial; handoff path bypasses contract-net style claims when energy is critical." },
    { component: "Dashboard (this repo)", description: "blindHandoffOverlay phases, aerial vs ground meshes, victim marker, dashed/solid lines, rescue_handoff event log." },
  ],
  operatorFlow: [
    "Start Search & Rescue demo → select scenario “Blind Handoff (Air-to-Ground)”.",
    "Watch aerial agent (low battery) and ground rovers; chaos slider optional for loss/latency.",
    "Observe event log: RESCUE_HANDOFF_REQUEST → HANDOFF_BID → HANDOFF_ACCEPT/ACK → RESCUE_COMPLETE.",
    "In 3D: dashed aerial→victim cue during negotiation; solid rover→victim once accepted; victim turns green on complete.",
    "Python: run `PYTHONPATH=. python -m pytest swarm/tests/test_blind_handoff.py` for protocol integration (headless).",
  ],
  baselineTest: {
    title: "Baseline — single victim, two ground bidders",
    summary:
      "One aerial with low battery initiates handoff; two ground nodes at different distances bid; closest wins, reaches victim, and emits RESCUE_COMPLETE.",
    setup: [
      "Shared NetworkEmulator + NetworkSimulator; three DroneController instances registered on the mesh.",
      "Victim at (10,0,0); aerial at (0,0); ground at (8,0) vs (30,0); STANDBY roles; mock_data disabled for determinism.",
      "Temporarily extend HANDOFF_BID_WINDOW_SEC or invoke _process_handoff_bids manually after synchronous bid delivery.",
    ],
    procedure: [
      "Call initiate_handoff(victim) on aerial with low_battery=True.",
      "Confirm both ground nodes sent HANDOFF_BID and aerial stored sorted distances.",
      "After accept, verify only the closer rover enters rescue behavior.",
      "Sim-step until GPS within RESCUE_ARRIVAL_DISTANCE; assert RESCUE_COMPLETE side effects (_rescued_victim_keys).",
    ],
    passCriteria: [
      "Winner is the minimum-distance bidder.",
      "Loser remains in explore with no current_handoff_rescue.",
      "Victim key marked rescued and handoff state cleared on rescuer.",
    ],
  },
  extendedValidation: [
    {
      title: "Insufficient ground battery",
      bullets: [
        "Force ground battery below distance * GROUND_BATTERY_PER_METER + GROUND_BATTERY_RESERVE; expect no bid.",
        "Aerial should see zero bids and log a no-bid handoff (optional retry policy).",
      ],
    },
    {
      title: "Concurrent victims",
      bullets: [
        "Two handoff_id timers in flight; ensure bids stay partitioned per id.",
        "Busy ground rover (already rescuing) must ignore new RESCUE_HANDOFF_REQUEST.",
      ],
    },
    {
      title: "Lossy mesh",
      bullets: [
        "Raise packetLoss on aerial↔ground edges; rely on longer bid window or app-level retry of RESCUE_HANDOFF_REQUEST.",
      ],
    },
  ],
  pythonArtifacts: [
    { label: "Controller + protocol", path: "swarm/drone_controller.py" },
    { label: "Unicast mesh", path: "swarm/network_emulator.py" },
    { label: "Vertex send()", path: "swarm/vertex_node.py" },
    { label: "Integration test", path: "swarm/tests/test_blind_handoff.py" },
    { label: "Webots / headless launcher", path: "swarm/webots_controller.py, scripts/run_headless.py" },
  ],
};
