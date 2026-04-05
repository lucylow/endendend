import type { GossipMessage, PartitionInfo, PeerInfo, StateEntry, SwarmStatePayload, VersionVector } from "@/types/p2p";

export interface ManagedState {
  entries: Record<string, StateEntry>;
  localVersionVector: Record<string, number>;
  versionVectors: VersionVector[];
}

const SWARM_STATE_KEY = "swarm_state_v1";

export type SwarmPersistedSnapshot = SwarmStatePayload & { soloMode: boolean };

export function createInitialState(): ManagedState {
  return { entries: {}, localVersionVector: {}, versionVectors: [] };
}

export function updateLocalState(
  state: ManagedState,
  key: string,
  value: unknown,
  nodeId: string,
): { state: ManagedState; message: GossipMessage } {
  const prev = state.entries[key]?.version ?? 0;
  const version = prev + 1;
  const entry: StateEntry = {
    key,
    value,
    version,
    updatedBy: nodeId,
    timestamp: Date.now(),
  };
  const localVersionVector = { ...state.localVersionVector, [key]: version };
  const entries = { ...state.entries, [key]: entry };
  const newState: ManagedState = { ...state, entries, localVersionVector };
  const message: GossipMessage = {
    id: `su-${Date.now()}`,
    type: "STATE_UPDATE",
    source: nodeId,
    target: "broadcast",
    payload: { key, value, version },
    timestamp: Date.now(),
    ttl: 8,
  };
  return { state: newState, message };
}

export function handleStateUpdate(state: ManagedState, msg: GossipMessage): ManagedState {
  if (msg.type !== "STATE_UPDATE") return state;
  const { key, value, version } = msg.payload as { key: string; value: unknown; version: number };
  if (typeof key !== "string" || typeof version !== "number") return state;
  const cur = state.entries[key]?.version ?? 0;
  if (version <= cur) return state;
  const entry: StateEntry = {
    key,
    value,
    version,
    updatedBy: msg.source,
    timestamp: msg.timestamp,
  };
  return {
    ...state,
    entries: { ...state.entries, [key]: entry },
    localVersionVector: { ...state.localVersionVector, [key]: version },
  };
}

export function generateVersionVectorBroadcast(state: ManagedState, nodeId: string): GossipMessage {
  return {
    id: `vv-${Date.now()}`,
    type: "STATE_VECTOR",
    source: nodeId,
    target: "broadcast",
    payload: { versions: { ...state.localVersionVector } },
    timestamp: Date.now(),
    ttl: 6,
  };
}

export function detectDivergence(a: VersionVector, b: VersionVector): string[] {
  const keys = new Set([...Object.keys(a.versions), ...Object.keys(b.versions)]);
  const out: string[] = [];
  for (const k of keys) {
    if ((a.versions[k] ?? 0) !== (b.versions[k] ?? 0)) out.push(k);
  }
  return out;
}

export function generateSyncRequests(_state: ManagedState, divergentKeys: string[], nodeId: string): GossipMessage[] {
  if (divergentKeys.length === 0) return [];
  return [
    {
      id: `sync-req-${Date.now()}`,
      type: "STATE_SYNC_REQUEST",
      source: nodeId,
      target: "broadcast",
      payload: { keys: divergentKeys },
      timestamp: Date.now(),
      ttl: 4,
    },
  ];
}

export function detectPartitions(peers: Record<string, PeerInfo>): PartitionInfo[] {
  const byPart = new Map<string, string[]>();
  for (const p of Object.values(peers)) {
    const arr = byPart.get(p.partitionId) ?? [];
    arr.push(p.nodeId);
    byPart.set(p.partitionId, arr);
  }
  return [...byPart.entries()].map(([id, members]) => {
    const explorer = Object.values(peers).find((x) => x.partitionId === id && x.role === "explorer");
    return {
      id,
      members,
      explorerId: explorer?.nodeId ?? null,
      explorerVersion: explorer?.explorerVersion ?? 0,
      detectedAt: Date.now(),
    };
  });
}

export function mergePartitionStates(a: ManagedState, b: ManagedState): ManagedState {
  const entries = { ...a.entries };
  for (const [k, e] of Object.entries(b.entries)) {
    const cur = entries[k];
    if (!cur || e.version > cur.version) entries[k] = e;
  }
  const localVersionVector = { ...a.localVersionVector };
  for (const [k, v] of Object.entries(b.localVersionVector)) {
    if (v > (localVersionVector[k] ?? 0)) localVersionVector[k] = v;
  }
  return {
    ...a,
    entries,
    localVersionVector,
    versionVectors: [...a.versionVectors, ...b.versionVectors],
  };
}

export function saveSwarmState(snapshot: SwarmPersistedSnapshot): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SWARM_STATE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadSwarmState(): Partial<SwarmPersistedSnapshot> | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(SWARM_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SwarmPersistedSnapshot>;
  } catch {
    return null;
  }
}
