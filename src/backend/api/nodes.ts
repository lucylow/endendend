import type { NodeRegistry } from "@/backend/lattice/node-registry";
import { MissionLedger } from "@/backend/vertex/mission-ledger";
import type { RosterEntry } from "@/backend/shared/mission-state";

export async function latticeRecordHeartbeat(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  nodeId: string,
  nowMs: number,
  tel: Partial<{ batteryReserve: number; linkQuality: number; sensors: string[] }>,
): Promise<void> {
  registry.heartbeat(nodeId, tel, nowMs);
  await ledger.append({
    missionId,
    actorId: nodeId,
    eventType: "node_heartbeat",
    plane: "lattice",
    payload: { nodeId, ...tel },
    timestamp: nowMs,
    previousHash: ledger.tailHash(),
  });
}

/** Vertex-committed roster join (discovery / presence). */
export async function commitNodeJoin(
  ledger: MissionLedger,
  registry: NodeRegistry,
  missionId: string,
  entry: RosterEntry,
  nowMs: number,
): Promise<void> {
  await ledger.append({
    missionId,
    actorId: entry.nodeId,
    eventType: "node_join",
    plane: "vertex",
    payload: {
      nodeId: entry.nodeId,
      role: entry.role,
      capabilities: entry.capabilities,
    },
    timestamp: nowMs,
    previousHash: ledger.tailHash(),
  });
  registry.addOrUpdateRosterEntry(entry);
}
