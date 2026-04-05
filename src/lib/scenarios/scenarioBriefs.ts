/**
 * Judge- and investor-facing narratives for each SAR preset (Vertex + FoxMQ, no cloud).
 * Pairs with {@link SAR_SCENARIOS} slugs.
 */
export interface ScenarioBrief {
  setup: string;
  emergentBehavior: string;
  successMetric: string;
  failureMode: string;
  /** Why Tashi / Vertex matters for this story */
  tashiNote?: string;
  /** Suggested demo beats */
  demoTiming?: readonly string[];
  judgeQuote?: string;
}

export const SCENARIO_BRIEF_BY_SLUG: Record<string, ScenarioBrief> = {
  "dynamic-relay": {
    setup:
      "Eight agents advance down a linear tunnel; effective RF decays about every 20 m so direct surface link dies with depth.",
    emergentBehavior:
      "Standbys self-elect as relays at depth bands (e.g. ~60 m, ~100 m) so the lead keeps a multi-hop chain; the front explorer pushes toward ~140 m while mid-chain nodes hold position.",
    successMetric: "Lead agent’s committed consensus rounds stay under ~100 ms equivalent latency to the surface path in the KPI panel.",
    failureMode: "Fixed manual relay slots — one dead hop collapses the whole chain.",
    tashiNote: "Stake-weighted promotion picks who anchors each hop; FoxMQ-style gossip carries heartbeats without a planner.",
    demoTiming: [
      "0:00 — Watch packet stress rise with depth (tunnel + chaos slider).",
      "0:15 — Mid-swarm agents stop and light up as relays.",
      "0:30 — Chain extends; lead keeps moving while latency trace stays green.",
      "0:45 — Reset and contrast with relay links off / static assignment.",
    ],
    judgeQuote: "That’s actually solving real physics, not a slideshow.",
  },
  "victim-priority": {
    setup:
      "Six rovers sweep a notional grid; a high-value victim cue appears in one sector (simulated target discovery).",
    emergentBehavior:
      "Vertex-weighted bids pull the nearest high-stake units onto the victim while others form relays or continue search lanes.",
    successMetric: "Time-to-converge on the cue beats a naive static reassignment baseline in the dashboard narrative (~20 s class win).",
    failureMode: "Central dispatcher reassigns everyone — bandwidth implodes and edges starve.",
    tashiNote: "Stake priority emerges from the mesh; no cloud auctioneer.",
    demoTiming: [
      "0:00 — Six rovers grid search (assigned sectors).",
      "0:12 — Rover C detects victim (red beacon).",
      "0:18 — Stake voting → high-priority units converge; others relay / search.",
      "0:35 — Victim reached ~23 s faster than static narrative in the panel.",
      "0:45 — Role badges show emergent coordination.",
    ],
    judgeQuote: "It just… works. No central controller.",
  },
  "battery-cascade": {
    setup:
      "Lead explorer battery drops toward empty; three relays sit at ~25% while standby units hold ~80% — classic cascade setup.",
    emergentBehavior:
      "Heartbeat consensus flags degradation; standby agents auto-promote into the relay chain so the lead keeps mission continuity.",
    successMetric: "Mission continues ~42% longer in the narrative than a centralized fallback that freezes for replan.",
    failureMode: "Ops toggles a static backup list — wrong hop order and the chain dies before promotion completes.",
    tashiNote: "Promotion is negotiated on the mesh, not pushed from a control tower.",
    demoTiming: [
      "0:00 — Lead + relay chain advancing.",
      "0:10 — Lead battery hits the danger band; relays report low reserves.",
      "0:20 — Standby promotion votes complete; chain holds.",
      "0:40 — Explorer keeps pushing while replacements backfill.",
    ],
  },
  "circular-bypass": {
    setup: "Cluttered ring / aisle layout; agents must flow around obstacles.",
    emergentBehavior: "Proximity mesh + local rules yield lane-aware detours without a global grid solver.",
    successMetric: "Zero hard collisions in the 3D envelope while maintaining target progress.",
    failureMode: "Global A* refresh every tick — jitter and compute blow the demo budget.",
    tashiNote: "Good fit for FoxMQ local maps merged lazily.",
  },
  "flash-override": {
    setup: "Routine exploration traffic fills the mesh; an emergency quorum triggers.",
    emergentBehavior: "Flash path preempts non-critical gossip; latency stays bounded under load.",
    successMetric: "Consensus latency widget stays under your SLO while override is active.",
    failureMode: "Priority as a single boolean flag — starvation hides until demo day.",
    tashiNote: "Weighted votes make override measurable, not vibes-based.",
  },
  "thermal-rebalance": {
    setup: "Agents accrue ‘heat’ from RF + compute; hot nodes throttle.",
    emergentBehavior: "Cooler neighbors advance into the gap; load redistributes.",
    successMetric: "Throughput variance drops vs uniform speed (see speedup narrative).",
    failureMode: "Static duty cycle — hot spots persist and drop packets.",
    tashiNote: "Maps cleanly to real throttling + backoff policies.",
  },
  "magnetic-attraction": {
    setup: "Victim cues emit a soft ‘field’ in the sim; agents have stake-weighted sensitivity.",
    emergentBehavior: "High-stake units couple harder to the field while separation rules avoid pile-ups.",
    successMetric: "Clean convergence cone in top-down camera with no overlaps.",
    failureMode: "Single-task greedy assignment — ignores mesh splits.",
    tashiNote: "Stake gradients ≈ priority fields; Vertex collapses conflicts.",
  },
  "tunnel-collapse": {
    setup: "Controlled packet storm mid-demo; Byzantine count may rise with chaos.",
    emergentBehavior: "PBFT-style rounds either commit a relay layout or fail loud — no silent wrong leader.",
    successMetric: "Quorum visible in consensus metrics; no phantom commits.",
    failureMode: "Majority without BFT — one bad node flips the story.",
    tashiNote: "Pairs with swarm/bft_pbft.py narrative in backend tests.",
  },
  "multi-swarm-handoff": {
    setup:
      "Swarm A (exploration) closes on a heavy pallet; Swarm B (lift) stands by in a separate fleet envelope — independent processes, one mesh contract. Full-screen: /scenarios/multi-swarm-handoff; embedded: SAR → Multi-Swarm Handoff.",
    emergentBehavior:
      "Target coordinates plus stake hints cross via a FoxMQ-style broadcast; Swarm B adopts an optimal approach vector and forms a lift ring without a cloud handshake.",
    successMetric: "~18 ms class handoff with zero downtime in the metrics panel; scalable to independent swarms.",
    failureMode: "Central mission server serializes both fleets — handoff latency explodes and one failure domain owns both.",
    tashiNote: "Proves fleet-scale continuity: discoverers and executors stay loosely coupled.",
    demoTiming: [
      "0:00 — Swarm A explores toward the pallet.",
      "0:12 — Broadcast: coordinates + stakes (simulated).",
      "0:18 — Swarm B activates; approach vector aligns.",
      "0:30 — Zero-downtime handoff narrative complete.",
      "0:45 — Heavy lift formation around target.",
    ],
    judgeQuote: "That's true fleet scalability.",
  },
  "arena-race": {
    setup:
      "Procedural warehouse: ten agents, pallets + shelving, green start and gold finish — full 3D course at /scenarios/arena-obstacle.",
    emergentBehavior: "Goal + repulsion + separation + lane bias; no central path server.",
    successMetric: "First across the line; metrics rail shows swarm time vs coarse grid A* baseline (≥ ~27% faster for demo).",
    failureMode: "Pre-baked paths — judges smell scripting.",
    tashiNote: "Use Reseed + difficulty between takes.",
  },
  "stake-voting": {
    setup:
      "Agents sit on a fork: path A (longer, risky) vs path B (shorter, optimal). Preferences are an even head-count split; economic stake is uneven so weighted votes differ from pure democracy.",
    emergentBehavior:
      "Live tally sums stake on each side; the swarm steers toward the weighted winner. High-stake agents move with higher conviction (scale / height in the 3D view).",
    successMetric: "~92% optimal decisions under stake weighting vs ~51% head-count baseline (design narrative on the rail).",
    failureMode: "Equalize stakes — the fork ties or flips; one-agent-one-vote without stake recreates Sybil-class ambiguity.",
    tashiNote: "Staking is the anti-Sybil knob: votes track economic weight, not IP count.",
    demoTiming: [
      "0:00 — Even split on preferences; weighted bar already skewed by stake.",
      "0:12 — Large agents (high stake) pull the field toward path B.",
      "0:20 — Consensus steers the swarm onto the optimal fork.",
      "0:35 — Compare stake-weighted % vs democracy % on the rail.",
      "0:45 — Equal stakes control to show the tie / flip.",
    ],
    judgeQuote: "Economic incentives literally changed the group decision.",
  },
  "predator-evasion": {
    setup:
      "A red forklift-style threat crosses the warehouse floor toward a patrol formation; mission corridor continues beyond the threat axis.",
    emergentBehavior:
      "On detection, agents enter an orthogonal scatter, then reform behind the threat vector while keeping separation.",
    successMetric: "Zero hard collisions in the envelope; mission delay narrative ~8s vs static pile-up baseline.",
    failureMode: "Ignoring lateral separation — agents clip each other or the threat volume.",
    tashiNote: "Local mesh decisions (scatter/reform) without a central safety controller.",
    demoTiming: [
      "0:00 — Formation advances; forklift idle path.",
      "0:08 — Auto threat arm — scatter phase (green).",
      "0:15 — Reform phase (blue) behind threat.",
      "0:25 — Mission resumes with delay clock vs static baseline.",
    ],
    judgeQuote: "That is forklift avoidance, not a slide.",
  },
  "random-failure": {
    setup: "Chaos slider cranks loss + Byzantine stress toward 40% class scenarios.",
    emergentBehavior: "Mesh retries, relay rotation, and consensus backoff keep KPIs in band.",
    successMetric: "Target ~98.7% effective uptime narrative at moderate chaos.",
    failureMode: "Single retry then give up — flappy demo.",
    tashiNote: "Use chaos 2–3 for investor ‘still standing’ moment.",
  },
  "warehouse-restock": {
    setup: "Twelve moving shelves, volatile SKU counts, two green restock beacons, ten picker agents.",
    emergentBehavior:
      "Nearest stocked-aisle scoring plus per-frame path renegotiation (obstacle repulsion + traffic deconfliction) as shelves slide on the floor.",
    successMetric: "Live picks/min vs modeled static planner (~3.2× faster narrative on the KPI rail).",
    failureMode: "Fixed-interval global A* — stale edges as racks shift; pickers queue behind ghosts.",
    demoTiming: [
      "0:00 — Shelves drift; inventory flickers.",
      "0:20 — Swarm lanes form around movers.",
      "0:45 — Metrics: continuous replan vs static baseline.",
      "1:00 — Chaos slider — stress motion + stock noise.",
    ],
  },
  "fallen-comrade": {
    setup: "Five rovers own vertical strips; one peer’s heartbeats stop.",
    emergentBehavior:
      "Survivors propose a fair geometric split of the orphan strip, vote, and apply sector bounds — leaderless backoff.",
    successMetric: "New bounds live within a few gossip rounds; no duplicate exploration of dead peer’s cleared cells.",
    failureMode: "Human reprograms sectors — seconds of blind coverage loss.",
    tashiNote: "Track 2 grid story; pairs with full operator script in this preset.",
    demoTiming: [
      "0:00 — Even strip search.",
      "0:10 — Kill / stop one rover.",
      "0:20 — Watch REALLOCATION_PROPOSAL class behavior in sim hooks.",
    ],
  },
};

export function getScenarioBrief(slug: string): ScenarioBrief | undefined {
  return SCENARIO_BRIEF_BY_SLUG[slug];
}
