/**
 * Guided walkthrough data for each scenario.
 * Each phase describes what is happening, what to watch, and what success looks like.
 */

export interface WalkthroughPhase {
  /** Short phase name, e.g. "Initialize" */
  title: string;
  /** Approximate time label, e.g. "0:00 – 0:10" */
  time: string;
  /** What is happening in this phase */
  description: string;
  /** What the user should look for on screen */
  watchFor: string;
}

export interface ScenarioWalkthrough {
  /** One-line scenario purpose */
  purpose: string;
  /** What success looks like overall */
  successCriteria: string;
  /** Ordered mission phases */
  phases: WalkthroughPhase[];
}

export const SCENARIO_WALKTHROUGHS: Record<string, ScenarioWalkthrough> = {
  "dynamic-relay": {
    purpose: "Agents self-organize a communication chain as they push deeper into a signal-degrading tunnel.",
    successCriteria: "The lead explorer reaches maximum depth while consensus latency stays under 100 ms — the relay chain holds without any central planner.",
    phases: [
      { title: "Deploy", time: "0:00 – 0:10", description: "Agents enter the tunnel mouth and begin advancing. Signal strength is full near the surface.", watchFor: "All agents start as a cluster near the entrance. Packet stress is low (green)." },
      { title: "Signal decay", time: "0:10 – 0:20", description: "As depth increases, RF signal degrades. Direct links to the surface start dropping.", watchFor: "The signal strength indicator shifts from green toward amber. Connection lines thin out." },
      { title: "Relay election", time: "0:20 – 0:30", description: "Standby agents self-elect as relay nodes at depth bands, anchoring the communication chain.", watchFor: "Mid-swarm agents stop moving and their role badges flip to 'Relay' (blue). The chain topology appears." },
      { title: "Chain extension", time: "0:30 – 0:45", description: "The explorer keeps pushing forward while relays hold position. New relay hops are inserted as needed.", watchFor: "The lead agent continues advancing. Latency trace in the KPI panel stays green despite depth." },
      { title: "Mission hold", time: "0:45+", description: "The chain is fully formed. Data flows from the explorer back to the surface through multiple relay hops.", watchFor: "Stable consensus rounds in the metrics panel. No dropped connections in the chain." },
    ],
  },
  "collapsing-tunnel": {
    purpose: "Simulate structural collapse — the swarm detects heartbeat loss and reforms the relay chain in real time.",
    successCriteria: "After collapse, the swarm re-establishes a viable relay chain in under 2 seconds with zero data loss.",
    phases: [
      { title: "Baseline chain", time: "0:00 – 0:10", description: "A stable relay chain is operating normally. All heartbeats are regular.", watchFor: "Heartbeat indicators are all green. Relay chain lines are solid." },
      { title: "Collapse event", time: "0:10 – 0:15", description: "A section of tunnel collapses, severing one or more relay hops.", watchFor: "The collapse animation triggers. One or more agents go dark. Heartbeat status turns red." },
      { title: "Detection", time: "0:15 – 0:17", description: "Surviving agents detect missing heartbeats and flag the broken chain segment.", watchFor: "Heartbeat loss detection timeline lights up. Affected chain links flash." },
      { title: "Reformation", time: "0:17 – 0:20", description: "Standby agents promote into the gap. The chain reforms around the collapsed section.", watchFor: "New relay nodes appear in the chain. The recovery timer shows sub-2-second reformation." },
      { title: "Mission resumed", time: "0:20+", description: "The reformed chain is stable. The explorer continues its mission with a new route topology.", watchFor: "All metrics return to green. Chain reform timeline shows the complete recovery sequence." },
    ],
  },
  "battery-cascade": {
    purpose: "Agents deplete batteries at different rates — the swarm auto-promotes standby nodes to sustain the mission.",
    successCriteria: "Mission continues ~42% longer than a centralized fallback, with zero chain breaks during relay rotation.",
    phases: [
      { title: "Advance", time: "0:00 – 0:10", description: "The relay chain is advancing. The lead explorer consumes battery faster due to sensor load.", watchFor: "Battery meters on each agent. The lead's bar drops noticeably faster than relays." },
      { title: "Degradation", time: "0:10 – 0:25", description: "Lead battery enters the danger band. Relay nodes report diminishing reserves.", watchFor: "Battery status turns amber/red on the lead. Degradation warnings appear in the timeline." },
      { title: "Promotion vote", time: "0:25 – 0:30", description: "Heartbeat consensus flags the cascade risk. Standby agents with higher charge begin promotion voting.", watchFor: "Promotion vote events in the history panel. Standby agents light up as candidates." },
      { title: "Relay rotation", time: "0:30 – 0:40", description: "Fresh agents slide into the chain. Depleted nodes step back to standby or return to base.", watchFor: "Smooth handoff in the chain visualization. No gaps or latency spikes during rotation." },
      { title: "Extended mission", time: "0:40+", description: "The chain operates with rotated personnel. Mission duration metric exceeds the static baseline.", watchFor: "Mission duration metric vs. baseline comparison on the metrics panel." },
    ],
  },
  "random-failure": {
    purpose: "Inject random faults and watch the swarm self-heal through consensus and automatic relay insertion.",
    successCriteria: "Effective uptime stays above ~98.7% even at moderate chaos levels, with automatic recovery from every failure.",
    phases: [
      { title: "Stable ops", time: "0:00 – 0:10", description: "The swarm is operating normally. Baseline metrics are established.", watchFor: "All health indicators green. Performance continuity chart is flat and stable." },
      { title: "Fault injection", time: "0:10 – 0:20", description: "Random failures begin. Agents drop out unpredictably.", watchFor: "Failure visualizer shows red flashes. Agent count drops. Failure history logs events." },
      { title: "Self-healing", time: "0:20 – 0:35", description: "The mesh retries, rotates relays, and consensus backs off to maintain stability.", watchFor: "Resilience metrics: recovery time per fault, effective uptime percentage. New relays auto-insert." },
      { title: "Stress test", time: "0:35+", description: "Increase chaos slider to push the swarm harder. Observe how degradation curves respond.", watchFor: "Performance chart shows recovery patterns. Uptime stays high despite increasing fault rate." },
    ],
  },
  "magnetic-attraction": {
    purpose: "Agents converge on victim heat signatures using decentralized priority scoring and stake-weighted triage.",
    successCriteria: "Clean convergence on victim locations with no agent pile-ups — high-stake units arrive first.",
    phases: [
      { title: "Sweep", time: "0:00 – 0:10", description: "Agents spread out in a search pattern across the field.", watchFor: "Agents distributed evenly. Attraction field visualization is calm." },
      { title: "Detection", time: "0:10 – 0:18", description: "A victim cue is detected. The attraction field activates around the signal source.", watchFor: "Victim marker appears. Field lines radiate outward. Priority ranking updates." },
      { title: "Convergence", time: "0:18 – 0:30", description: "High-stake agents couple to the field and converge. Others maintain separation or relay.", watchFor: "Larger agents (higher stake) move faster toward the victim. Clean convergence cone in the view." },
      { title: "Triage", time: "0:30+", description: "Agents form a structured response around the victim. No pile-ups or collisions.", watchFor: "Selection metrics show stake-weighted ordering. No overlapping agents." },
    ],
  },
  "stake-voting": {
    purpose: "Agents vote on a path fork using BFT consensus weighted by economic stake — the swarm decides collectively.",
    successCriteria: "~92% optimal decisions under stake weighting vs ~51% with equal-weight voting.",
    phases: [
      { title: "Fork approach", time: "0:00 – 0:10", description: "Agents approach a decision point with two paths: risky but long (A) vs. shorter and optimal (B).", watchFor: "The forked path environment. Voting tally bar initializing." },
      { title: "Preference split", time: "0:10 – 0:18", description: "Agents express preferences. Head count is evenly split, but stake weights differ.", watchFor: "Vote visualizer shows even agent count but skewed stake bar. High-stake agents lean toward path B." },
      { title: "Consensus", time: "0:18 – 0:25", description: "Stake-weighted BFT resolves the vote. The swarm commits to the optimal path.", watchFor: "Vote tally completes. The swarm collectively turns toward path B." },
      { title: "Validation", time: "0:25+", description: "Compare the outcome against equal-weight democracy. Stake weighting consistently picks the better path.", watchFor: "Metrics rail: ~92% optimal vs ~51% baseline. The anti-Sybil advantage is visible." },
    ],
  },
  "predator-evasion": {
    purpose: "A threat crosses the swarm's path — agents scatter, evade, and reform without a central safety controller.",
    successCriteria: "Zero hard collisions, mission delay under ~8 seconds vs. static pile-up baseline.",
    phases: [
      { title: "Patrol", time: "0:00 – 0:08", description: "Agents advance in formation through the warehouse. Threat is idle.", watchFor: "Clean formation. Evasion metrics at zero." },
      { title: "Threat detection", time: "0:08 – 0:12", description: "The predator (forklift) enters the threat zone. Agents detect it automatically.", watchFor: "Threat indicator turns red. Agents begin scatter phase." },
      { title: "Scatter", time: "0:12 – 0:18", description: "Orthogonal scatter — agents move laterally to clear the threat vector.", watchFor: "Green scatter state on agents. No agent-to-agent or agent-to-threat collisions." },
      { title: "Reform", time: "0:18 – 0:28", description: "Threat passes. Agents reform behind the threat vector and resume mission.", watchFor: "Blue reform state. Formation reassembles. Mission delay clock vs. static baseline." },
    ],
  },
  "warehouse-restock": {
    purpose: "Picker agents navigate moving shelves and volatile inventory to restock beacons — continuous path renegotiation.",
    successCriteria: "Live picks/min exceeds the static planner baseline by ~3.2×.",
    phases: [
      { title: "Inventory scan", time: "0:00 – 0:15", description: "Shelves begin drifting. Inventory levels flicker. Agents assess the environment.", watchFor: "Moving shelves in the warehouse environment. Inventory counts changing." },
      { title: "Lane formation", time: "0:15 – 0:30", description: "Agents form traffic lanes around moving obstacles. Path renegotiation is per-frame.", watchFor: "Agents routing around shelves without collisions. Lane patterns emerging." },
      { title: "Restocking", time: "0:30 – 0:50", description: "Agents reach restock beacons and deliver. Success animations trigger.", watchFor: "Restock success animations at beacon locations. Picks/min metric climbing." },
      { title: "Stress test", time: "0:50+", description: "Increase chaos to add more shelf motion and stock noise. Observe swarm adaptation.", watchFor: "Performance metric: continuous replan vs. static planner baseline comparison." },
    ],
  },
};

export function getScenarioWalkthrough(slug: string): ScenarioWalkthrough | undefined {
  return SCENARIO_WALKTHROUGHS[slug];
}
