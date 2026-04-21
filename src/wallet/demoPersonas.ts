export type DemoNetworkId =
  | "demo-mainnet"
  | "demo-testnet"
  | "arc-simulated-settlement"
  | "vertex-demo-network";

export interface DemoPersona {
  id: string;
  name: string;
  roleLabel: string;
  narrative: string;
  defaultNetwork: DemoNetworkId;
  /** Stable seed fragment mixed into deterministic demo addresses */
  addressSeed: string;
  recommendedMissionRole: string;
  emoji: string;
  mockBalance: string;
}

export const DEMO_NETWORK_LABELS: Record<DemoNetworkId, string> = {
  "demo-mainnet": "Demo mainnet (simulated)",
  "demo-testnet": "Demo testnet (simulated)",
  "arc-simulated-settlement": "Arc simulated settlement",
  "vertex-demo-network": "Vertex demo ordering plane",
};

export const DEFAULT_DEMO_PERSONA_ID = "mission-commander";

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "mission-commander",
    name: "Avery Chen",
    roleLabel: "Mission Commander",
    narrative: "Owns mission command envelopes, phase transitions, and Arc settlement readiness for the swarm.",
    defaultNetwork: "vertex-demo-network",
    addressSeed: "cmd-seed-v1",
    recommendedMissionRole: "command",
    emoji: "🛰️",
    mockBalance: "125000.00 DEMO",
  },
  {
    id: "explorer-drone",
    name: "Unit Explorer-7",
    roleLabel: "Explorer Drone Operator",
    narrative: "Pilots frontier cells, signs exploration proofs, and feeds Lattice validation streams.",
    defaultNetwork: "demo-testnet",
    addressSeed: "exp-seed-v1",
    recommendedMissionRole: "explorer",
    emoji: "🛸",
    mockBalance: "48250.50 DEMO",
  },
  {
    id: "relay-node",
    name: "Relay Node Orion",
    roleLabel: "Relay Node Operator",
    narrative: "Maintains multi-hop relay graph health and attests bandwidth / latency manifests.",
    defaultNetwork: "vertex-demo-network",
    addressSeed: "relay-seed-v1",
    recommendedMissionRole: "relay",
    emoji: "📡",
    mockBalance: "9100.00 DEMO",
  },
  {
    id: "triage-coordinator",
    name: "Dr. Sam Rivera",
    roleLabel: "Triage Coordinator",
    narrative: "Sequences victim priority models and signs triage checkpoints for rescue handoff.",
    defaultNetwork: "demo-mainnet",
    addressSeed: "tri-seed-v1",
    recommendedMissionRole: "triage",
    emoji: "🩺",
    mockBalance: "22000.00 DEMO",
  },
  {
    id: "rescue-lead",
    name: "Jordan Malik",
    roleLabel: "Rescue Lead",
    narrative: "Authorizes extraction windows, safety holds, and mission completion certificates.",
    defaultNetwork: "arc-simulated-settlement",
    addressSeed: "rescue-seed-v1",
    recommendedMissionRole: "rescue",
    emoji: "🎖️",
    mockBalance: "67300.00 DEMO",
  },
  {
    id: "arc-settler",
    name: "Ledger Clerk (Arc)",
    roleLabel: "Arc Settler",
    narrative: "Finalizes public proof bundles, reward manifests, and settlement previews for judges.",
    defaultNetwork: "arc-simulated-settlement",
    addressSeed: "arc-seed-v1",
    recommendedMissionRole: "settlement",
    emoji: "⚖️",
    mockBalance: "500000.00 DEMO",
  },
];

export function getDemoPersonaById(id: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => p.id === id);
}
