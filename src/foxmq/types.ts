import type { MissionScenarioKind } from "@/backend/shared/mission-scenarios";

/** FoxMQ-style mesh message kinds for distributed map sync. */
export type FoxMqMessageKind =
  | "map_delta_publish"
  | "map_snapshot_publish"
  | "state_ack"
  | "peer_sync_request"
  | "recovery_sync_request"
  | "replay_request"
  | "node_heartbeat"
  | "stale_node_notice"
  | "partition_notice"
  | "rejoin_notice";

export type FoxMqDeliveryStatus = "pending" | "delivered" | "acked" | "dropped" | "duplicate";

export type FoxMqEnvelopeBase = {
  messageType: FoxMqMessageKind;
  sender: string;
  recipient?: string;
  missionId: string;
  mapId: string;
  version: number;
  sequence: number;
  checksum: string;
  timestamp: number;
  deliveryStatus: FoxMqDeliveryStatus;
};

export type FoxMqMapEnvelope = FoxMqEnvelopeBase & {
  payload: unknown;
};

export type DistributedMemoryCommitStatus = "pending" | "relayed" | "committed" | "rejected";

export type DistributedMemoryEventType =
  | "cell_update"
  | "map_delta"
  | "snapshot_commit"
  | "sync_request"
  | "sync_ack"
  | "node_disconnect"
  | "node_reconnect"
  | "offline_buffer"
  | "recovery_merge"
  | "partition"
  | "partition_heal"
  | "replay_tick";

export type ScenarioMapProfile = {
  scenario: MissionScenarioKind;
  frontierDensity01: number;
  hazardRate01: number;
  targetScatter01: number;
  syncUrgency01: number;
  offlineToleranceMs: number;
  relayImportance01: number;
  confidenceFloor01: number;
};

export const FOXMQ_DEFAULT_MAP_ID = "fleet_world";
