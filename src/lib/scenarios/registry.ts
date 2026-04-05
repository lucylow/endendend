import type { CameraMode } from "@/features/swarm/useSwarmVisualization";
import {
  DYNAMIC_DAISY_CHAIN_DEMO_SCRIPT,
  type DaisyChainDemoScript,
} from "@/lib/scenarios/dynamicDaisyChainDemoScript";
import { BLIND_HANDOFF_DEMO_SCRIPT } from "@/lib/scenarios/blindHandoffDemoScript";
import { FALLEN_COMRADE_DEMO_SCRIPT } from "@/lib/scenarios/fallenComradeDemoScript";

export type ScenarioPhase = 1 | 2 | 3;

export type { DaisyChainDemoScript };

export interface ScenarioDefinition {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  phase: ScenarioPhase;
  phaseLabel: string;
  tagline: string;
  pitch: string;
  judgeBeat: string;
  /** Rich operator narrative (e.g. Dynamic Daisy Chain, Fallen Comrade). */
  demoScript?: DaisyChainDemoScript;
  viz: {
    tunnelMode: boolean;
    connectionMode: "relay-chain" | "proximity";
    cameraDefault: CameraMode;
    defaultSpeed: number;
  };
}

export const SAR_SCENARIOS: ScenarioDefinition[] = [
  {
    id: "1",
    slug: "dynamic-relay",
    name: "Dynamic Relay Chain",
    emoji: "🥾",
    phase: 1,
    phaseLabel: "Exploration",
    tagline: "Radio degrades with depth — relays self-elect.",
    pitch: "P2P chain extends as the explorer advances; stake-weighted promotion keeps the backbone alive.",
    judgeBeat: "0:00 — Watch the relay chain auto-extend.",
    demoScript: DYNAMIC_DAISY_CHAIN_DEMO_SCRIPT,
    viz: {
      tunnelMode: true,
      connectionMode: "relay-chain",
      cameraDefault: "follow-leader",
      defaultSpeed: 1.2,
    },
  },
  {
    id: "2",
    slug: "victim-priority",
    name: "Victim Priority",
    emoji: "🤖",
    phase: 1,
    phaseLabel: "Exploration",
    tagline: "Highest-stake bids win rescue tasks.",
    pitch: "Vertex-weighted auction converges the nearest capable ground unit on the victim cue.",
    judgeBeat: "0:15 — Victim priority emerges from stake voting.",
    viz: {
      tunnelMode: true,
      connectionMode: "relay-chain",
      cameraDefault: "top-down",
      defaultSpeed: 1,
    },
  },
  {
    id: "3",
    slug: "battery-cascade",
    name: "Battery Cascade Failure Recovery",
    emoji: "🔥",
    phase: 1,
    phaseLabel: "Exploration",
    tagline: "Lead drain → relay brownout → standby auto-promote; +42% mission extension.",
    pitch:
      "Tunnel relay chain with realistic role-based drain, 50ms-class heartbeat windows, cascade at ~45s, and emergent relay promotion — dedicated 3D course at /scenarios/battery-cascade.",
    judgeBeat: "0:45 — cascade → heartbeat → promote → mission continues (+42% vs abort baseline).",
    viz: {
      tunnelMode: true,
      connectionMode: "relay-chain",
      cameraDefault: "orbit",
      defaultSpeed: 1.4,
    },
  },
  {
    id: "4",
    slug: "circular-bypass",
    name: "Circular Obstacle Bypass",
    emoji: "🌀",
    phase: 1,
    phaseLabel: "Exploration",
    tagline: "FoxMQ vectors + Vertex voting → emergent CCW bypass.",
    pitch:
      "Concrete pillar warehouse: swarm mode fuses repulsion, boids, and stake-weighted circulation; leader–follower baseline shows higher hull contact — /scenarios/obstacle-bypass or /scenarios/circular-bypass.",
    judgeBeat: "Toggle LF vs swarm — clearance vs ~37% baseline card.",
    viz: {
      tunnelMode: true,
      connectionMode: "proximity",
      cameraDefault: "top-down",
      defaultSpeed: 1.1,
    },
  },
  {
    id: "5",
    slug: "flash-override",
    name: "Flash Override",
    emoji: "⚡",
    phase: 2,
    phaseLabel: "Extraction",
    tagline: "Emergency quorum preempts routine tasks.",
    pitch: "A flash incident injects priority; consensus latency stays bounded under load.",
    judgeBeat: "Flash path — latency graph stays green.",
    viz: {
      tunnelMode: false,
      connectionMode: "relay-chain",
      cameraDefault: "follow-leader",
      defaultSpeed: 2.8,
    },
  },
  {
    id: "6",
    slug: "thermal-rebalance",
    name: "Thermal Rebalance",
    emoji: "🌡️",
    phase: 2,
    phaseLabel: "Extraction",
    tagline: "Hot agents throttle; cool agents advance.",
    pitch: "Thermal metaphor maps to compute + RF heat — the mesh load-balances without static schedules.",
    judgeBeat: "Forklift heat — fleet reshapes lanes.",
    viz: {
      tunnelMode: false,
      connectionMode: "proximity",
      cameraDefault: "orbit",
      defaultSpeed: 1.2,
    },
  },
  {
    id: "7",
    slug: "magnetic-attraction",
    name: "Magnetic Attraction",
    emoji: "🧲",
    phase: 2,
    phaseLabel: "Extraction",
    tagline: "Victims pull convergence fields.",
    pitch: "Stake gradients attract agents toward high-value targets while preserving separation.",
    judgeBeat: "3D convergence toward the cue.",
    viz: {
      tunnelMode: true,
      connectionMode: "proximity",
      cameraDefault: "top-down",
      defaultSpeed: 1,
    },
  },
  {
    id: "8",
    slug: "tunnel-collapse",
    name: "Tunnel Collapse",
    emoji: "🕳️",
    phase: 2,
    phaseLabel: "Extraction",
    tagline: "Packet loss spikes — BFT still decides.",
    pitch: "Controlled collapse raises drop probability; PBFT-style rounds either commit or fail loud.",
    judgeBeat: "Packet storm — quorum visible in the log.",
    viz: {
      tunnelMode: true,
      connectionMode: "relay-chain",
      cameraDefault: "orbit",
      defaultSpeed: 0.9,
    },
  },
  {
    id: "9",
    slug: "multi-swarm-handoff",
    name: "Multi-Swarm Handoff",
    emoji: "🔄",
    phase: 2,
    phaseLabel: "Extraction",
    tagline: "Swarm A finds → FoxMQ transfer → Swarm B heavy lift (18ms consensus).",
    pitch:
      "Exploration fleet closes on the pallet; coordinates and stakes broadcast FoxMQ-style; lift fleet adopts an approach vector and ring formation — zero cloud handshake. Full-screen dual-fleet course: /scenarios/multi-swarm-handoff.",
    judgeBeat: "0:18 — metrics show zero-downtime handoff; Swarm B forms on target.",
    viz: {
      tunnelMode: true,
      connectionMode: "relay-chain",
      cameraDefault: "follow-leader",
      defaultSpeed: 1,
    },
  },
  {
    id: "10",
    slug: "arena-race",
    name: "Arena Obstacle Course",
    emoji: "🎪",
    phase: 3,
    phaseLabel: "Validation",
    tagline: "Ten agents, warehouse clutter, swarm vs grid A* baseline.",
    pitch:
      "Procedural pallets and shelving; emergent blend of goal seeking, repulsion, and flocking races to the gold finish — dedicated 3D course at /scenarios/arena-obstacle.",
    judgeBeat: "Start race — first across the line; metrics panel shows swarm vs A* baseline.",
    viz: {
      tunnelMode: false,
      connectionMode: "proximity",
      cameraDefault: "top-down",
      defaultSpeed: 2.2,
    },
  },
  {
    id: "11",
    slug: "stake-voting",
    name: "Stake-Weighted Voting",
    emoji: "🎮",
    phase: 3,
    phaseLabel: "Validation",
    tagline: "50/50 preferences — high stake tips toward the optimal fork (~92% vs ~51%).",
    pitch:
      "Full-screen crossroads: weighted tally vs head-count baseline; glow and scale encode stake; controls rebalance economics — /scenarios/stake-voting.",
    judgeBeat: "Equal stakes (tie) vs boost optimal — watch the live bar flip.",
    viz: {
      tunnelMode: false,
      connectionMode: "relay-chain",
      cameraDefault: "orbit",
      defaultSpeed: 1,
    },
  },
  {
    id: "12",
    slug: "predator-evasion",
    name: "Predator Evasion",
    emoji: "🛡️",
    phase: 3,
    phaseLabel: "Validation",
    tagline: "Forklift threat — scatter, reform, zero collisions; ~8s mission delay story.",
    pitch:
      "Warehouse forklift crosses the formation; orthogonal scatter then reform behind; metrics rail for separation and delay vs static baseline — /scenarios/predator-evasion.",
    judgeBeat: "Threat on — green scatter phase — reform — mission resumes.",
    viz: {
      tunnelMode: false,
      connectionMode: "proximity",
      cameraDefault: "orbit",
      defaultSpeed: 1.5,
    },
  },
  {
    id: "13",
    slug: "random-failure",
    name: "Random Failure",
    emoji: "🎲",
    phase: 3,
    phaseLabel: "Validation",
    tagline: "40% agent stress — mesh holds.",
    pitch: "Chaos toggles loss + byzantine counts; KPIs target 98.7% effective uptime in the dashboard.",
    judgeBeat: "1:00 — 40% loss → performance holds.",
    viz: {
      tunnelMode: true,
      connectionMode: "relay-chain",
      cameraDefault: "top-down",
      defaultSpeed: 1,
    },
  },
  {
    id: "14",
    slug: "warehouse-restock",
    name: "Warehouse Dynamic Restocking",
    emoji: "🏭",
    phase: 3,
    phaseLabel: "Validation",
    tagline: "Moving shelves + inventory flux — swarm replans every frame.",
    pitch:
      "Kiva-style drifting aisles, stock that spawns and drains, and ten pickers using continuous repulsion-based replanning vs a fixed-interval static baseline — full-screen course at /scenarios/warehouse-restock (alias /scenarios/warehouse-restocking).",
    judgeBeat: "0:45 — KPI rail shows ~3.2× restock throughput vs static baseline.",
    viz: {
      tunnelMode: false,
      connectionMode: "relay-chain",
      cameraDefault: "top-down",
      defaultSpeed: 1.6,
    },
  },
  {
    id: "15",
    slug: "fallen-comrade",
    name: "Fallen Comrade",
    emoji: "🛡️",
    phase: 1,
    phaseLabel: "Exploration",
    tagline: "Heartbeat loss → sector re-split with no leader.",
    pitch:
      "Five vertical strips; one rover dies; survivors propose, vote, and apply a fair partition of the orphaned strip — P2P only.",
    judgeBeat: "Stop Rover B — new sector bounds within ~5–10s.",
    demoScript: FALLEN_COMRADE_DEMO_SCRIPT,
    viz: {
      tunnelMode: false,
      connectionMode: "proximity",
      cameraDefault: "top-down",
      defaultSpeed: 1,
    },
  },
  {
    id: "16",
    slug: "blind-handoff",
    name: "Blind Handoff (Air-to-Ground)",
    emoji: "✈️",
    phase: 2,
    phaseLabel: "Extraction",
    tagline: "Low-battery aerial spots victim; ground rovers bid; closest rescues — no cloud.",
    pitch:
      "RESCUE_HANDOFF_REQUEST → HANDOFF_BID → HANDOFF_ACCEPT/ACK → RESCUE_COMPLETE over Vertex P2P only; battery-aware aerial defers to heavy ground assets.",
    judgeBeat: "0:20 — dashed cue to victim; solid line to rescuer; green complete.",
    demoScript: BLIND_HANDOFF_DEMO_SCRIPT,
    viz: {
      tunnelMode: false,
      connectionMode: "proximity",
      cameraDefault: "top-down",
      defaultSpeed: 1.15,
    },
  },
];

export function getScenarioBySlug(slug: string | undefined): ScenarioDefinition | undefined {
  if (!slug) return undefined;
  return SAR_SCENARIOS.find((s) => s.slug === slug);
}
