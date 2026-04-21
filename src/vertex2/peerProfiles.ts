import type { SwarmAgentNode } from "@/backend/vertex/swarm-types";
import type { MissionNodeRole } from "@/backend/shared/mission-state";
import type { MeshPeerRuntime, Vertex2MeshRole, Vertex2NodeKind } from "./types";
import { mulberry32 } from "./seededRng";
import { clamp01 } from "./normalizers";

type ProfileTemplate = {
  kind: Vertex2NodeKind;
  meshRole: Vertex2MeshRole;
  mapsToSwarmRole: MissionNodeRole;
  vendorModel: string;
  heartbeatMs: number;
  latencyBiasMs: number;
  lossSensitivity01: number;
  autonomy01: number;
  relay01: number;
  byzantineLike01: number;
};

const TEMPLATES: ProfileTemplate[] = [
  {
    kind: "scout_drone",
    meshRole: "explorer",
    mapsToSwarmRole: "explorer",
    vendorModel: "LatticeSense / Scout-X",
    heartbeatMs: 420,
    latencyBiasMs: 12,
    lossSensitivity01: 0.35,
    autonomy01: 0.82,
    relay01: 0.22,
    byzantineLike01: 0.01,
  },
  {
    kind: "relay_drone",
    meshRole: "relay",
    mapsToSwarmRole: "relay",
    vendorModel: "Meshworks / Relay-H2",
    heartbeatMs: 300,
    latencyBiasMs: 6,
    lossSensitivity01: 0.18,
    autonomy01: 0.55,
    relay01: 0.95,
    byzantineLike01: 0.0,
  },
  {
    kind: "indoor_robot",
    meshRole: "sensor",
    mapsToSwarmRole: "explorer",
    vendorModel: "SubTerra / UGV-7",
    heartbeatMs: 650,
    latencyBiasMs: 25,
    lossSensitivity01: 0.42,
    autonomy01: 0.74,
    relay01: 0.18,
    byzantineLike01: 0.0,
  },
  {
    kind: "rescue_robot",
    meshRole: "rescuer",
    mapsToSwarmRole: "carrier",
    vendorModel: "HeavyLift / HL-Rescue",
    heartbeatMs: 520,
    latencyBiasMs: 18,
    lossSensitivity01: 0.3,
    autonomy01: 0.7,
    relay01: 0.28,
    byzantineLike01: 0.0,
  },
  {
    kind: "coordinator_node",
    meshRole: "coordinator",
    mapsToSwarmRole: "observer",
    vendorModel: "VertexEdge / Coord-1",
    heartbeatMs: 280,
    latencyBiasMs: 4,
    lossSensitivity01: 0.2,
    autonomy01: 0.45,
    relay01: 0.62,
    byzantineLike01: 0.02,
  },
  {
    kind: "backup_relay",
    meshRole: "standby",
    mapsToSwarmRole: "relay",
    vendorModel: "Meshworks / Relay-Lite",
    heartbeatMs: 360,
    latencyBiasMs: 10,
    lossSensitivity01: 0.24,
    autonomy01: 0.58,
    relay01: 0.78,
    byzantineLike01: 0.0,
  },
  {
    kind: "sensor_node",
    meshRole: "sensor",
    mapsToSwarmRole: "observer",
    vendorModel: "ArcIoT / SensePod",
    heartbeatMs: 900,
    latencyBiasMs: 40,
    lossSensitivity01: 0.5,
    autonomy01: 0.88,
    relay01: 0.12,
    byzantineLike01: 0.0,
  },
  {
    kind: "transport_node",
    meshRole: "transport",
    mapsToSwarmRole: "carrier",
    vendorModel: "CargoHop / T-12",
    heartbeatMs: 580,
    latencyBiasMs: 22,
    lossSensitivity01: 0.33,
    autonomy01: 0.66,
    relay01: 0.35,
    byzantineLike01: 0.0,
  },
];

export function templateForIndex(i: number): ProfileTemplate {
  return TEMPLATES[i % TEMPLATES.length];
}

export function mapSwarmRoleToMeshRole(role: MissionNodeRole): Vertex2MeshRole {
  switch (role) {
    case "explorer":
      return "explorer";
    case "relay":
      return "relay";
    case "carrier":
      return "transport";
    case "medic":
      return "triage";
    case "observer":
      return "sensor";
    default:
      return "explorer";
  }
}

export function enrichPeerFromNode(node: SwarmAgentNode, index: number, rng: () => number): MeshPeerRuntime {
  const tpl = templateForIndex(index);
  const meshRole = tpl.mapsToSwarmRole === node.role ? tpl.meshRole : mapSwarmRoleToMeshRole(node.role);
  const jitter = () => (rng() - 0.5) * 0.06;
  return {
    peerId: node.nodeId,
    displayName: node.displayName,
    nodeKind: tpl.kind,
    meshRole,
    vendorModel: tpl.vendorModel,
    trust01: clamp01(node.trust01 + jitter()),
    health: node.offline ? "offline" : node.healthStatus === "degraded" ? "degraded" : "ok",
    battery01: clamp01(0.62 + rng() * 0.35),
    heartbeatIntervalMs: tpl.heartbeatMs + Math.floor(rng() * 120 - 60),
    latencyBiasMs: tpl.latencyBiasMs + Math.floor(rng() * 18),
    lossSensitivity01: clamp01(tpl.lossSensitivity01 + jitter()),
    localAutonomy01: clamp01(tpl.autonomy01 + (node.autonomyPolicy.includes("scout") ? 0.06 : 0)),
    queueDepth: Math.floor(rng() * 6),
    relayScore01: clamp01(tpl.relay01 + (node.role === "relay" ? 0.12 : 0) + jitter()),
    lastNeighbors: [],
    knownPeers: [node.nodeId],
    reachablePeers: [node.nodeId],
    suspectedPeers: [],
    stalePeers: [],
    newlyDiscovered: [],
    missionNote: "local_autonomy_ready",
    partitionId: "p0",
    recovery: "steady",
    byzantineLike01: clamp01(tpl.byzantineLike01 + rng() * 0.02),
  };
}

export function createProfileRng(seed: number): () => number {
  return mulberry32((seed ^ 0xcafe) >>> 0);
}
