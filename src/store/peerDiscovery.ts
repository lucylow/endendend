import type { CoordinationEvent, GossipMessage, PeerInfo } from "@/types/p2p";
import { ACTIVE_HEARTBEAT_MS, PEER_REMOVE_MS } from "@/config/swarmRobustness";

/** Active peer: heartbeat within this window. */
const HEARTBEAT_STALE_MS = ACTIVE_HEARTBEAT_MS;
/** Total silence since last heartbeat before marking dead (stale in between). */
const HEARTBEAT_DEAD_MS = PEER_REMOVE_MS;

export function createInitialPeers(
  agents: {
    id: string;
    name: string;
    role: string;
    battery: number;
    position: { x: number; y: number; z: number };
  }[],
): Record<string, PeerInfo> {
  const now = Date.now();
  const peers: Record<string, PeerInfo> = {};
  agents.forEach((a, idx) => {
    const role = (a.role === "explorer" || a.role === "relay" || a.role === "standby" ? a.role : "standby") as PeerInfo["role"];
    peers[a.id] = {
      nodeId: a.id,
      name: a.name,
      status: "active",
      lastHeartbeat: now,
      depth: idx * 8 + Math.random() * 2,
      role,
      explorerVersion: role === "explorer" ? 1 : 0,
      explorerSince: role === "explorer" ? now : 0,
      partitionId: "main",
      battery: a.battery,
      position: { ...a.position },
    };
  });
  return peers;
}

export function updatePeerStatuses(
  peers: Record<string, PeerInfo>,
  now: number,
  localNodeId: string,
): {
  updatedPeers: Record<string, PeerInfo>;
  events: CoordinationEvent[];
  metrics: { staleTransitions: number; deadTransitions: number };
} {
  const updatedPeers = { ...peers };
  const events: CoordinationEvent[] = [];
  let staleTransitions = 0;
  let deadTransitions = 0;

  for (const [id, p] of Object.entries(updatedPeers)) {
    if (id === localNodeId) continue;
    const silent = now - p.lastHeartbeat;
    if (p.status === "active" && silent > HEARTBEAT_STALE_MS) {
      updatedPeers[id] = { ...p, status: "stale", staleSince: now };
      staleTransitions++;
      events.push({
        id: `ev-stale-${id}-${now}`,
        timestamp: now,
        type: "peer_stale",
        description: `${p.name} marked stale (${Math.round(silent)}ms since heartbeat)`,
        nodeId: id,
      });
    } else if (p.status === "stale" && silent > HEARTBEAT_DEAD_MS) {
      updatedPeers[id] = { ...p, status: "dead" };
      deadTransitions++;
      events.push({
        id: `ev-dead-${id}-${now}`,
        timestamp: now,
        type: "peer_dead",
        description: `${p.name} considered dead after extended silence`,
        nodeId: id,
      });
    }
  }

  return { updatedPeers, events, metrics: { staleTransitions, deadTransitions } };
}

export function performGossipRound(
  peers: Record<string, PeerInfo>,
  localNodeId: string,
): { messages: GossipMessage[]; events: CoordinationEvent[] } {
  const messages: GossipMessage[] = [];
  const events: CoordinationEvent[] = [];
  const snapshot = Object.values(peers)
    .filter((p) => p.status !== "dead")
    .map((p) => ({
      id: p.nodeId,
      role: p.role,
      depth: p.depth,
      status: p.status,
    }));
  const msg: GossipMessage = {
    id: `gossip-${Date.now()}`,
    type: "GOSSIP_PEERS",
    source: localNodeId,
    target: "broadcast",
    payload: { peers: snapshot },
    timestamp: Date.now(),
    ttl: 6,
  };
  messages.push(msg);
  events.push({
    id: `ev-gossip-${Date.now()}`,
    timestamp: Date.now(),
    type: "gossip_sent",
    description: `Gossip round: ${snapshot.length} peers advertised`,
  });
  return { messages, events };
}

export function handleGossipReceived(
  msg: GossipMessage,
  peers: Record<string, PeerInfo>,
): Record<string, PeerInfo> {
  if (msg.type !== "GOSSIP_PEERS") return peers;
  const list = msg.payload.peers as Array<{ id: string; role: string; depth: number; status: string }>;
  if (!Array.isArray(list)) return peers;
  const next = { ...peers };
  for (const row of list) {
    if (!next[row.id]) continue;
    const cur = next[row.id];
    next[row.id] = {
      ...cur,
      depth: row.depth,
      role: (row.role as PeerInfo["role"]) || cur.role,
    };
  }
  return next;
}

export function generateHeartbeats(
  peers: Record<string, PeerInfo>,
  localNodeId: string,
): GossipMessage[] {
  const out: GossipMessage[] = [];
  const targets = Object.keys(peers).filter((id) => id !== localNodeId && peers[id].status !== "dead");
  for (const t of targets) {
    out.push({
      id: `hb-${localNodeId}-${t}-${Date.now()}`,
      type: "HEARTBEAT",
      source: localNodeId,
      target: t,
      payload: { depth: peers[localNodeId]?.depth ?? 0, battery: peers[localNodeId]?.battery ?? 0 },
      timestamp: Date.now(),
      ttl: 4,
    });
  }
  return out;
}

export function markPeerStale(peers: Record<string, PeerInfo>, peerId: string, now: number): Record<string, PeerInfo> {
  const p = peers[peerId];
  if (!p) return peers;
  return {
    ...peers,
    [peerId]: { ...p, status: "stale", staleSince: now },
  };
}

/** Seeking / partition heal: periodic DISCOVER flood while isolated. */
export function generateDiscoverMessages(localNodeId: string, depth: number, battery: number): GossipMessage[] {
  const now = Date.now();
  return [
    {
      id: `disc-${localNodeId}-${now}`,
      type: "DISCOVER",
      source: localNodeId,
      target: "broadcast",
      payload: { depth, battery, seeking: true },
      timestamp: now,
      ttl: 8,
    },
  ];
}
