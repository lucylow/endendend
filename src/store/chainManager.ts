import type {
  ChainHealth,
  ChainRepairAttempt,
  CoordinationEvent,
  ElectionState,
  GossipMessage,
  PeerInfo,
  RelayChainState,
  SwarmStatePayload,
} from "@/types/p2p";
import { RELAY_INSERTION_DISTANCE_STEP } from "@/config/swarmRobustness";

export function buildRelayChain(
  peers: Record<string, PeerInfo>,
  explorerId: string | null,
  health: ChainHealth = "stable",
  previous?: RelayChainState,
): RelayChainState {
  const alive = Object.values(peers).filter((p) => p.status !== "dead");
  if (!explorerId || !peers[explorerId]) {
    return {
      chain: [],
      version: Date.now(),
      updatedAt: Date.now(),
      updatedBy: "chain",
      shadowChain: previous?.shadowChain ?? previous?.chain,
      chainHealth: health,
    };
  }
  const relays = alive
    .filter((p) => p.nodeId !== explorerId && p.role === "relay" && p.status === "active")
    .sort((a, b) => a.depth - b.depth);
  const chain = [...relays.map((p) => p.nodeId), explorerId];
  const shadow = previous?.chain?.length ? [...previous.chain] : chain.length ? [...chain] : undefined;
  return {
    chain,
    version: Date.now(),
    updatedAt: Date.now(),
    updatedBy: "chain",
    shadowChain: shadow,
    chainHealth: health,
  };
}

export function attemptChainRepair(
  relayChain: RelayChainState,
  failedNodeId: string,
  peers: Record<string, PeerInfo>,
): {
  repair: ChainRepairAttempt;
  newChain: RelayChainState | null;
  events: CoordinationEvent[];
  messages: GossipMessage[];
} {
  const idx = relayChain.chain.indexOf(failedNodeId);
  const repair: ChainRepairAttempt = {
    id: `repair-${Date.now()}`,
    failedNode: failedNodeId,
    predecessor: idx > 0 ? relayChain.chain[idx - 1] : null,
    successor: idx >= 0 && idx < relayChain.chain.length - 1 ? relayChain.chain[idx + 1] : null,
    strategy: "bypass",
    status: "attempting",
    timestamp: Date.now(),
  };
  const events: CoordinationEvent[] = [
    {
      id: `ev-cr-${repair.id}`,
      timestamp: Date.now(),
      type: "chain_repair_start",
      description: `Chain repair for failed node ${failedNodeId}`,
      nodeId: failedNodeId,
    },
  ];
  const messages: GossipMessage[] = [];

  if (idx < 0) {
    repair.status = "failed";
    events.push({
      id: `ev-crf-${repair.id}`,
      timestamp: Date.now(),
      type: "chain_repair_fail",
      description: `Node ${failedNodeId} not in chain`,
      nodeId: failedNodeId,
    });
    return { repair, newChain: null, events, messages };
  }

  const predId = idx > 0 ? relayChain.chain[idx - 1] : null;
  const succId =
    idx >= 0 && idx < relayChain.chain.length - 1 ? relayChain.chain[idx + 1] : null;
  const dPred = predId ? peers[predId]?.depth ?? 0 : 0;
  const dSucc = succId ? peers[succId]?.depth ?? 0 : 0;
  const gap = predId && succId ? Math.abs(dSucc - dPred) : Infinity;
  const directLinkOk = predId && succId && gap <= RELAY_INSERTION_DISTANCE_STEP * 2;
  repair.strategy = directLinkOk ? "bypass" : "rebuild";

  const nextChain = relayChain.chain.filter((id) => id !== failedNodeId);
  const explorerId = nextChain[nextChain.length - 1] ?? null;
  const newChain: RelayChainState = {
    chain: nextChain,
    version: relayChain.version + 1,
    updatedAt: Date.now(),
    updatedBy: "repair",
    shadowChain: relayChain.shadowChain?.length ? relayChain.shadowChain : [...relayChain.chain],
    chainHealth: directLinkOk ? "repairing" : "degraded",
  };

  if (!directLinkOk && predId && succId) {
    messages.push({
      id: `crr-${Date.now()}`,
      type: "CHAIN_REPAIR_REQUEST",
      source: predId,
      target: succId,
      payload: { failed: failedNodeId, depth: dPred, gap },
      timestamp: Date.now(),
      ttl: 6,
    });
    events.push({
      id: `ev-crr-${repair.id}`,
      timestamp: Date.now(),
      type: "bypass_attempt",
      description: `Gap ${gap.toFixed(1)}m > 2×relay step — CHAIN_REPAIR_REQUEST ${predId} → ${succId}`,
      nodeId: failedNodeId,
    });
  }

  repair.status = nextChain.length > 0 ? "success" : "failed";
  events.push({
    id: `ev-crs-${repair.id}`,
    timestamp: Date.now(),
    type: repair.status === "success" ? "chain_repair_success" : "chain_repair_fail",
    description:
      repair.status === "success"
        ? `${directLinkOk ? "Direct link" : "Segment rebuild"}: chain length ${nextChain.length}, explorer ${explorerId}`
        : "Repair failed — empty chain",
    nodeId: failedNodeId,
  });

  messages.push({
    id: `chain-up-${Date.now()}`,
    type: "CHAIN_UPDATE",
    source: "system",
    target: "broadcast",
    payload: { chain: nextChain, explorerId },
    timestamp: Date.now(),
    ttl: 6,
  });

  return { repair, newChain: repair.status === "success" ? newChain : null, events, messages };
}

export function runElection(
  candidateId: string,
  peers: Record<string, PeerInfo>,
): { election: ElectionState; events: CoordinationEvent[]; messages: GossipMessage[] } {
  const candidate = peers[candidateId];
  const now = Date.now();
  const activeIds = Object.keys(peers).filter((id) => peers[id].status === "active");
  const quorumNeeded = Math.max(2, Math.ceil(activeIds.length / 2));
  const votes = activeIds.filter(() => Math.random() > 0.15);
  const won = votes.length >= quorumNeeded && candidate?.status === "active";

  const election: ElectionState = {
    candidateId,
    depth: candidate?.depth ?? 0,
    explorerVersion: (candidate?.explorerVersion ?? 0) + 1,
    votes,
    quorumNeeded,
    status: won ? "won" : "lost",
    startedAt: now,
  };

  const events: CoordinationEvent[] = [
    {
      id: `ev-el-${now}`,
      timestamp: now,
      type: won ? "election_won" : "election_lost",
      description: won
        ? `Election won by ${candidate?.name ?? candidateId} (depth ${election.depth.toFixed(1)})`
        : `Election lost — quorum ${votes.length}/${quorumNeeded}`,
      nodeId: candidateId,
    },
  ];

  const messages: GossipMessage[] = [
    {
      id: `el-vote-${now}`,
      type: "ELECTION_VOTE",
      source: candidateId,
      target: "broadcast",
      payload: { votes, quorumNeeded, status: election.status },
      timestamp: now,
      ttl: 4,
    },
  ];

  return { election, events, messages };
}

export function checkVolunteerRelay(
  standby: PeerInfo,
  relayChain: RelayChainState,
  peers: Record<string, PeerInfo>,
  scoreThreshold: number,
): { shouldVolunteer: boolean; event?: CoordinationEvent; message?: GossipMessage } {
  if (standby.role !== "standby" || standby.status !== "active") {
    return { shouldVolunteer: false };
  }
  if (relayChain.chain.length < 2) return { shouldVolunteer: false };
  const lastRelay = relayChain.chain[relayChain.chain.length - 2];
  const target = peers[lastRelay];
  if (!target || target.status !== "dead") return { shouldVolunteer: false };
  if (scoreThreshold < 10 || standby.battery < 25) return { shouldVolunteer: false };
  if (Math.random() > 0.35) return { shouldVolunteer: false };

  const now = Date.now();
  return {
    shouldVolunteer: true,
    event: {
      id: `ev-vol-${now}`,
      timestamp: now,
      type: "volunteer_relay",
      description: `${standby.name} volunteers to replace failed relay`,
      nodeId: standby.nodeId,
    },
    message: {
      id: `vol-${now}`,
      type: "VOLUNTEER_RELAY",
      source: standby.nodeId,
      target: "broadcast",
      payload: { replace: lastRelay },
      timestamp: now,
      ttl: 5,
    },
  };
}

export function buildSwarmStatePayload(
  peers: Record<string, PeerInfo>,
  relayChain: RelayChainState,
  explorerId: string | null,
): SwarmStatePayload {
  const now = Date.now();
  const drones = Object.values(peers).map((p) => ({
    id: p.nodeId,
    name: p.name,
    depth: p.depth,
    role: p.role,
    timestamp: p.lastHeartbeat,
    explorerSince: p.explorerSince,
    battery: p.battery,
    status: p.status,
  }));
  return {
    drones,
    chain: [...relayChain.chain],
    shadowChain: relayChain.shadowChain ? [...relayChain.shadowChain] : [...relayChain.chain],
    explorerId,
    chainHealth: relayChain.chainHealth ?? "stable",
    savedAt: now,
  };
}

function depthOf(id: string | null, drones: Map<string, SwarmStatePayload["drones"][0]>): number {
  if (!id) return -1;
  return drones.get(id)?.depth ?? -1;
}

/** Merge remote meet-and-greet snapshot with local view (newest per drone, explorer by depth then id). */
export function mergeSwarmStatePayloads(
  local: SwarmStatePayload,
  remote: SwarmStatePayload,
): SwarmStatePayload {
  const combined = new Map<string, SwarmStatePayload["drones"][0]>();
  for (const d of local.drones) combined.set(d.id, { ...d });
  for (const d of remote.drones) {
    const cur = combined.get(d.id);
    if (!cur || d.timestamp > cur.timestamp) combined.set(d.id, { ...d });
  }

  const drones = [...combined.values()];
  let explorerId = local.explorerId;
  const remoteExplorer = remote.explorerId;
  const dm = new Map(drones.map((x) => [x.id, x] as const));
  const ld = depthOf(explorerId, dm);
  const rd = depthOf(remoteExplorer, dm);
  if (remoteExplorer && remoteExplorer !== explorerId) {
    if (rd > ld) explorerId = remoteExplorer;
    else if (rd === ld && remoteExplorer < (explorerId ?? "")) explorerId = remoteExplorer;
  }

  const chain =
    remote.savedAt > local.savedAt && remote.chain.length >= local.chain.length ? [...remote.chain] : [...local.chain];
  const shadowChain =
    local.shadowChain.length >= remote.shadowChain.length ? [...local.shadowChain] : [...remote.shadowChain];

  return {
    drones,
    chain,
    shadowChain,
    explorerId,
    chainHealth: "forming",
    savedAt: Math.max(local.savedAt, remote.savedAt),
  };
}

export function applyPayloadToPeers(
  peers: Record<string, PeerInfo>,
  payload: SwarmStatePayload,
): Record<string, PeerInfo> {
  const next = { ...peers };
  for (const d of payload.drones) {
    if (!next[d.id]) continue;
    const cur = next[d.id];
    next[d.id] = {
      ...cur,
      depth: d.depth,
      lastHeartbeat: Math.max(cur.lastHeartbeat, d.timestamp),
      explorerSince: Math.max(cur.explorerSince, d.explorerSince),
      battery: d.battery,
      status: d.status,
    };
  }
  const ex = payload.explorerId;
  if (ex) {
    const now = Date.now();
    for (const id of Object.keys(next)) {
      if (id === ex) {
        next[id] = {
          ...next[id],
          role: "explorer",
          explorerSince: next[id].explorerSince || now,
          explorerVersion: next[id].explorerVersion + 1,
        };
      } else if (next[id].role === "explorer") {
        next[id] = { ...next[id], role: "standby" };
      }
    }
  }
  return next;
}

/** Deeper returning explorer requests takeover; current explorer steps down if shallower. */
export function handleExplorerTakeover(
  peers: Record<string, PeerInfo>,
  currentExplorerId: string | null,
  requesterId: string,
  requesterDepth: number,
): {
  nextPeers: Record<string, PeerInfo>;
  nextExplorerId: string | null;
  events: CoordinationEvent[];
  messages: GossipMessage[];
  accepted: boolean;
} {
  const events: CoordinationEvent[] = [];
  const messages: GossipMessage[] = [];
  const now = Date.now();

  if (!currentExplorerId || currentExplorerId === requesterId) {
    return { nextPeers: peers, nextExplorerId: currentExplorerId, events, messages, accepted: false };
  }
  const current = peers[currentExplorerId];
  const requester = peers[requesterId];
  if (!current || !requester || requesterDepth <= current.depth) {
    return { nextPeers: peers, nextExplorerId: currentExplorerId, events, messages, accepted: false };
  }

  const nextPeers = { ...peers };
  nextPeers[currentExplorerId] = {
    ...current,
    role: "standby",
  };
  nextPeers[requesterId] = {
    ...requester,
    role: "explorer",
    explorerSince: requester.explorerSince || now,
    explorerVersion: requester.explorerVersion + 1,
  };

  events.push({
    id: `ev-takeover-${now}`,
    timestamp: now,
    type: "explorer_takeover",
    description: `${requester.name} (${requesterDepth.toFixed(1)}m) takes explorer from ${current.name} (${current.depth.toFixed(1)}m)`,
    nodeId: requesterId,
  });
  messages.push({
    id: `tack-${now}`,
    type: "TAKEOVER_ACK",
    source: currentExplorerId,
    target: requesterId,
    payload: { yielded: true },
    timestamp: now,
    ttl: 4,
  });

  return {
    nextPeers,
    nextExplorerId: requesterId,
    events,
    messages,
    accepted: true,
  };
}
