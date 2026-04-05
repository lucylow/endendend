import type { PeerInfo } from "@/types/p2p";

const KEY = "drone_node_state_v1";

export interface DroneNodePersisted {
  nodeId: string;
  role: PeerInfo["role"];
  depth: number;
  chainHint: string[];
  peerIds: string[];
  savedAt: number;
}

export function saveDroneNodeState(state: DroneNodePersisted): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadDroneNodeState(): Partial<DroneNodePersisted> | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<DroneNodePersisted>;
  } catch {
    return null;
  }
}
