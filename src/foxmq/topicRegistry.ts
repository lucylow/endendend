import { FOXMQ_DEFAULT_MAP_ID } from "./types";

export function topicMapDelta(missionId: string): string {
  return `foxmq/${missionId}/${FOXMQ_DEFAULT_MAP_ID}/map_delta`;
}

export function topicMapSnapshot(missionId: string): string {
  return `foxmq/${missionId}/${FOXMQ_DEFAULT_MAP_ID}/map_snapshot`;
}

export function topicRecovery(missionId: string): string {
  return `foxmq/${missionId}/${FOXMQ_DEFAULT_MAP_ID}/recovery`;
}

export function topicPartition(missionId: string): string {
  return `foxmq/${missionId}/mesh/partition`;
}
