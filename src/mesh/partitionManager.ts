import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";

export type PartitionSummary = {
  clusterCount: number;
  largestClusterSize: number;
  operatorClusterSize: number;
  bridgeHintCount: number;
};

export function summarizePartitions(snap: ConnectivitySnapshot, operatorId: string): PartitionSummary {
  const clusterCount = Math.max(1, snap.partitionClusters.length);
  let largest = 0;
  let opCluster = 0;
  for (const c of snap.partitionClusters) {
    largest = Math.max(largest, c.length);
    if (c.includes(operatorId)) opCluster = c.length;
  }
  const bridgeHintCount = snap.relayChains?.length ?? 0;
  return { clusterCount, largestClusterSize: largest, operatorClusterSize: opCluster, bridgeHintCount };
}
