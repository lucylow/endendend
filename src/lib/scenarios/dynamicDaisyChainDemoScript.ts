/**
 * Example Scenario 1 — Dynamic Daisy Chain (collapsed tunnel, degrading RF).
 * Mirrors the Vertex Swarm SAR “Track 2” narrative: autonomous relay formation
 * without a central cloud.
 */
export interface DaisyChainDemoScript {
  promptTitle: string;
  setting: string;
  goal: string;
  behaviors: string[];
  architecture: { component: string; description: string }[];
  operatorFlow: string[];
  baselineTest: {
    title: string;
    summary: string;
    setup: string[];
    procedure: string[];
    passCriteria: string[];
  };
  extendedValidation: { title: string; bullets: string[] }[];
  pythonArtifacts: { label: string; path: string }[];
}

export const DYNAMIC_DAISY_CHAIN_DEMO_SCRIPT: DaisyChainDemoScript = {
  promptTitle: "The Dynamic Daisy Chain — Autonomous Relay Formation in a Degrading Tunnel",
  setting:
    "A collapsed tunnel up to ~200 m along the ingress axis. Depth 0 m is the entrance: strong RF to the outside. " +
    "Signal degrades with depth — about 50% loss to the entrance near 100 m, ~80% near 150 m, and practical blackout beyond 200 m without hops.",
  goal:
    "Keep a multi-hop P2P path from the lead explorer (deepest moving drone) back to the entrance at all times: no cloud, no static plan. " +
    "Standby drones become stationary relays; the chain grows, inserts mid-span relays, and repairs after failures.",
  behaviors: [
    "Discovery: peers find each other via mesh gossip/broadcast despite stochastic loss.",
    "Role election: one explorer advances; others start as standby (then relay as promoted).",
    "Relay chain: entrance → relay₁ → … → explorer; relays halt and forward explorer state upward.",
    "Dynamic insertion: when direct loss to the entrance or last hop exceeds threshold, promote a standby near the geometric midpoint.",
    "Failure recovery: heartbeat timeouts trigger bypass or full chain rebuild.",
    "State forwarding: position, sensors, and victim cues propagate to the entrance for logging or dashboard export.",
  ],
  architecture: [
    { component: "Drone controller", description: "Webots (or mock) loop: GPS depth, movement by role, Vertex I/O." },
    { component: "Vertex node", description: "P2P messaging, discovery, broadcast/fan-out through NetworkEmulator." },
    { component: "ChainManager", description: "Roles, chain order, relay insert/repair policy (extends exploration hooks)." },
    { component: "NetworkSimulator", description: "Per-link loss/latency; optional JSON timeline (scenario runner)." },
    { component: "Dashboard (optional)", description: "Tunnel view, chain edges, KPIs — mesh_stats HTTP + static HTML." },
  ],
  operatorFlow: [
    "Spawn N agents at the entrance; wait for discovery and heartbeat mesh.",
    "Elect explorer (deepest / policy winner); explorer advances at fixed speed (e.g. ~1 m/s).",
    "When depth or measured loss crosses threshold, explorer broadcasts relay need; best standby by depth accepts RELAY.",
    "Repeat insertion as the explorer moves (e.g. every ~20 m) until depth or standby pool limits the chain.",
    "Kill a mid-chain relay: neighbors detect timeout → BYPASS_REQUEST or rebuild; confirm explorer state still reaches entrance.",
  ],
  baselineTest: {
    title: "5.1 Baseline — initial chain formation",
    summary:
      "Prove the first hop: from a clean entrance mesh to one promoted relay when the explorer reaches ~30 m effective depth.",
    setup: [
      "Five drones at depth 0; default-open or low-loss full mesh among standbys.",
      "Shared NetworkSimulator / depth-based impairment so explorer→entrance loss rises as the lead moves inward.",
      "Logging on the entrance node (or mesh_stats) to observe forwarded explorer payloads.",
    ],
    procedure: [
      "Start controllers; confirm peer table populated within one discovery epoch.",
      "After election timeout, designate explorer (e.g. highest id or deepest GPS); verify forward motion only on explorer.",
      "When explorer effective depth crosses ~30 m, run relay selection: target first relay placement near ~15 m (midpoint 0–30).",
      "Confirm promoted drone transitions to RELAY, zero velocity, and begins forwarding heartbeats/state toward entrance.",
      "Verify entrance receives explorer-derived updates via the new hop (not only direct explorer→entrance if that link is impaired).",
    ],
    passCriteria: [
      "Exactly one explorer; at least one relay after depth threshold under degraded direct link.",
      "Relay position stable; explorer continues deeper without losing upstream connectivity through the chain.",
      "No central coordinator process required for promotion decision (decentralized messages only).",
    ],
  },
  extendedValidation: [
    {
      title: "5.2 Dynamic insertion",
      bullets: [
        "Add relays at successive depth bands; chain order matches monotonic depth toward explorer.",
        "Measure per-hop delivery ratio; explorer state arrival at entrance remains above acceptance threshold.",
      ],
    },
    {
      title: "5.3 Relay failure",
      bullets: [
        "Terminate one relay process; heartbeat gap detected within 2–3 intervals.",
        "Repair completes: bypass or new promotion; chain continuous again.",
      ],
    },
    {
      title: "5.4–5.6 Asymmetry, stress, scale",
      bullets: [
        "Enforce depth-diff caps (e.g. drop deep→shallow when Δ>20 m); relays spaced so each hop respects caps.",
        "Run 80% loss regimes; system stays up with higher latency.",
        "Smoke-test 20 agents: no message storm (rate-limited gossip / bounded fan-out).",
      ],
    },
  ],
  pythonArtifacts: [
    { label: "Scenario constants + JSON loader", path: "swarm/scenario_dynamic_daisy_chain.py" },
    { label: "Baseline timeline (ScenarioRunner)", path: "swarm/scenarios/scenario1_baseline_daisy_chain.json" },
    { label: "Generic timeline example", path: "swarm/scenario.example.json" },
  ],
};
