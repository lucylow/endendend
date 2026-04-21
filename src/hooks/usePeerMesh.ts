import { useMemo } from "react";
import { useVertexSwarmStore } from "@/store/vertexSwarmStore";
import { buildPeerReachabilityTable, buildPeerLinkViews, summarizePartitions, pickBestReroutePeer } from "@/swarm/networkModel";

/** Derived mesh analytics for graph-style widgets. */
export function usePeerMesh() {
  const view = useVertexSwarmStore((s) => s.view);

  return useMemo(() => {
    if (!view) {
      return {
        reachability: new Map(),
        links: [] as ReturnType<typeof buildPeerLinkViews>,
        partition: summarizePartitions(
          { edges: [], partitionClusters: [], operatorReachable: new Set(), relayChains: [], stalePeers: new Set() },
          "agent-cmd-e",
          [],
        ),
        rerouteHint: undefined as string | undefined,
      };
    }
    const op = view.operatorNodeId ?? "agent-cmd-e";
    const reach = buildPeerReachabilityTable(view.nodes, view.graph, op);
    const links = buildPeerLinkViews(view.graph, op, reach);
    const partition = summarizePartitions(view.graph, op, view.nodes.map((n) => n.nodeId));
    const rerouteHint = pickBestReroutePeer(view.nodes, view.graph);
    return { reachability: reach, links, partition, rerouteHint };
  }, [view]);
}
