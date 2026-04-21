import type { ConnectivitySnapshot } from "@/backend/vertex/swarm-types";

export function meshSummary(graph: ConnectivitySnapshot): { edgeCount: number; partitionClusters: number } {
  return { edgeCount: graph.edges.length, partitionClusters: graph.partitionClusters?.length ?? 0 };
}
