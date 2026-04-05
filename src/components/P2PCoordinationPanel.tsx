import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useP2PStore } from "@/store/p2pStore";
import { useSwarmStore } from "@/store/swarmStore";
import { RELAY_INSERTION_DISTANCE_STEP } from "@/config/swarmRobustness";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play, Pause, RotateCcw, Network, Radio, Shield, Split, Merge,
  Zap, AlertTriangle, RefreshCw, Wifi, WifiOff, Heart,
} from "lucide-react";

const eventIcons: Record<string, string> = {
  peer_discovered: "🔍", peer_stale: "⏳", peer_dead: "💀",
  gossip_sent: "📡", gossip_received: "📥",
  heartbeat_sent: "💓", heartbeat_timeout: "⏰",
  election_started: "🗳️", election_won: "👑", election_lost: "❌",
  role_change: "🔄", chain_updated: "⛓️",
  chain_repair_start: "🔧", chain_repair_success: "✅", chain_repair_fail: "❌",
  partition_detected: "🔀", partition_merged: "🔗",
  state_sync: "📋", state_conflict: "⚡",
  volunteer_relay: "🙋", bypass_attempt: "↗️", bypass_success: "✅", bypass_fail: "❌",
  solo_mode_entered: "🧑‍🚀", solo_mode_exited: "🛰️", state_merge: "🔁", meet_greet: "🤝",
  peer_leaving: "👋", explorer_takeover: "⚔️", discover_sent: "📡", reliable_degraded: "📵",
};

export default function P2PCoordinationPanel() {
  const swarmAgents = useSwarmStore((s) => s.agents);
  const {
    peers, relayChain, elections, partitions, metrics,
    coordinationEvents, p2pRunning, chainRepairs,
    initializeP2P, startP2P, stopP2P, resetP2P, tickP2P,
    triggerElection, triggerChainRepair, injectPartition, mergePartitions,
    simulateNodeFailure, simulateNodeRecovery, gracefulLeavePeer, requestExplorerTakeover,
    managedState,
    soloMode, requestStateMerge, currentExplorerId,
  } = useP2PStore();

  // Initialize P2P with swarm agents
  useEffect(() => {
    if (Object.keys(peers).length === 0 && swarmAgents.length > 0) {
      initializeP2P(swarmAgents);
    }
  }, [swarmAgents, peers, initializeP2P]);

  // Tick loop
  useEffect(() => {
    if (!p2pRunning) return;
    const iv = setInterval(tickP2P, 1000);
    return () => clearInterval(iv);
  }, [p2pRunning, tickP2P]);

  const peerList = Object.values(peers);
  const activePeers = peerList.filter(p => p.status === "active");
  const stalePeers = peerList.filter(p => p.status === "stale");
  const deadPeers = peerList.filter(p => p.status === "dead");
  const recentEvents = coordinationEvents.slice(-40).reverse();

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => (p2pRunning ? stopP2P() : startP2P())}>
            {p2pRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {p2pRunning ? "Pause P2P" : "Start P2P"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { resetP2P(); initializeP2P(swarmAgents); }}>
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground">
            {activePeers.length} active • {stalePeers.length} stale • {deadPeers.length} dead
          </span>
          {soloMode && (
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-accent text-accent bg-accent/10">
              Solo mesh
            </span>
          )}
          <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => requestStateMerge()}>
            Merge saved state
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        {[
          { label: "Gossip Sent", value: metrics.gossipMessagesSent, icon: Radio },
          { label: "Heartbeats", value: metrics.heartbeatsSent, icon: Heart },
          { label: "Elections", value: `${metrics.electionsWon}/${metrics.electionsHeld}`, icon: Shield },
          { label: "Repairs", value: `${metrics.chainRepairsSucceeded}/${metrics.chainRepairsAttempted}`, icon: RefreshCw },
          { label: "Partitions", value: partitions.length, icon: Split },
          { label: "State merges", value: metrics.stateMergesCompleted, icon: Merge },
          { label: "Reliable OK / fail", value: `${metrics.reliableDeliveries}/${metrics.reliableFailures}`, icon: AlertTriangle },
          { label: "Snapshots", value: metrics.stateSnapshotsBroadcast, icon: RefreshCw },
          { label: "DISCOVER", value: metrics.discoverBroadcasts, icon: Wifi },
          { label: "Avg Latency", value: `${metrics.messageLatencyAvg.toFixed(0)}ms`, icon: Zap },
        ].map((m) => (
          <Card key={m.label} className="bg-card/50 border-border">
            <CardContent className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <m.icon className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="font-mono text-sm font-bold text-primary">{m.value}</div>
              <div className="text-[9px] text-muted-foreground">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="peers" className="w-full">
        <TabsList className="bg-card/50 border border-border">
          <TabsTrigger value="peers">Peer Discovery</TabsTrigger>
          <TabsTrigger value="chain">Relay Chain</TabsTrigger>
          <TabsTrigger value="elections">Elections</TabsTrigger>
          <TabsTrigger value="state">State Sync</TabsTrigger>
          <TabsTrigger value="log">Coordination Log</TabsTrigger>
        </TabsList>

        {/* PEERS TAB */}
        <TabsContent value="peers" className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Network className="w-4 h-4" /> PEER MESH ({peerList.length} nodes)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {peerList.map((p) => (
                <div key={p.nodeId} className={`rounded-lg border p-2.5 text-xs transition-all ${
                  p.status === "dead" ? "border-destructive/40 bg-destructive/5 opacity-60" :
                  p.status === "stale" ? "border-warning/40 bg-warning/5" :
                  p.role === "explorer" ? "border-primary/40 bg-primary/5" :
                  "border-border bg-muted/20"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      p.status === "dead" ? "bg-destructive" : p.status === "stale" ? "bg-warning" : "bg-success"
                    }`} />
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <div>{p.role.toUpperCase()} • {p.status}</div>
                    <div>Depth: {p.depth.toFixed(1)} • Bat: {p.battery.toFixed(0)}%</div>
                    <div>Partition: {p.partitionId}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.status !== "dead" ? (
                      <>
                        <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => simulateNodeFailure(p.nodeId)}>
                          <WifiOff className="w-2.5 h-2.5" /> Kill
                        </Button>
                        <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => gracefulLeavePeer(p.nodeId)}>
                          Leave
                        </Button>
                        {currentExplorerId &&
                          p.nodeId !== currentExplorerId &&
                          p.depth > (peers[currentExplorerId]?.depth ?? 0) + RELAY_INSERTION_DISTANCE_STEP * 2 && (
                          <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => requestExplorerTakeover(p.nodeId)}>
                            Takeover
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => simulateNodeRecovery(p.nodeId)}>
                        <Wifi className="w-2.5 h-2.5" /> Revive
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Partition controls */}
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Split className="w-4 h-4" /> PARTITION CONTROLS
            </h4>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => {
                const ids = peerList.filter(p => p.status === "active").slice(-3).map(p => p.nodeId);
                if (ids.length > 0) injectPartition(ids);
              }}>
                <Split className="w-3 h-3" /> Inject Partition (last 3)
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={mergePartitions}>
                <Merge className="w-3 h-3" /> Merge All Partitions
              </Button>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              {partitions.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="font-mono">{p.id}:</span>
                  <span>{p.members.length} members</span>
                  {p.explorerId && <span className="text-primary">explorer: {peers[p.explorerId]?.name}</span>}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* CHAIN TAB */}
        <TabsContent value="chain" className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3">
              RELAY CHAIN (v{relayChain.version})
              {relayChain.chainHealth && (
                <span className="ml-2 text-primary">• {relayChain.chainHealth}</span>
              )}
            </h4>
            <div className="flex items-center gap-1 flex-wrap">
              <div className="rounded-md bg-success/20 text-success px-2 py-1 text-[10px] font-mono">BASE</div>
              {relayChain.chain.map((nodeId, i) => {
                const peer = peers[nodeId];
                return (
                  <div key={nodeId} className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">→</span>
                    <div className={`rounded-md px-2 py-1 text-[10px] font-mono border ${
                      peer?.role === "explorer" ? "bg-primary/20 text-primary border-primary/30" :
                      peer?.status === "dead" ? "bg-destructive/20 text-destructive border-destructive/30 line-through" :
                      "bg-accent/20 text-accent-foreground border-border"
                    }`}>
                      {peer?.name || nodeId}
                      <span className="text-muted-foreground ml-1">d:{peer != null ? peer.depth.toFixed(0) : "?"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {relayChain.shadowChain && relayChain.shadowChain.length > 0 && (
              <p className="mt-2 text-[10px] font-mono text-muted-foreground">
                Shadow chain (last known): {relayChain.shadowChain.map((id) => peers[id]?.name || id).join(" → ")}
              </p>
            )}

            {/* Chain repair controls */}
            <div className="mt-4">
              <h5 className="font-mono text-[10px] text-muted-foreground mb-2">REPAIR CONTROLS</h5>
              <div className="flex gap-1 flex-wrap">
                {relayChain.chain.filter(id => peers[id]?.role === "relay").map(id => (
                  <Button key={id} size="sm" variant="outline" className="h-6 text-[9px] gap-1" onClick={() => {
                    simulateNodeFailure(id);
                    setTimeout(() => triggerChainRepair(id), 100);
                  }}>
                    <AlertTriangle className="w-2.5 h-2.5" /> Fail {peers[id]?.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Recent repairs */}
            {chainRepairs.length > 0 && (
              <div className="mt-3 space-y-1">
                <h5 className="font-mono text-[10px] text-muted-foreground">RECENT REPAIRS</h5>
                {chainRepairs.slice(-5).reverse().map((r) => (
                  <div key={r.id} className={`text-[10px] font-mono px-2 py-1 rounded ${
                    r.status === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}>
                    {r.strategy}: {peers[r.failedNode]?.name} — {r.status}
                    {r.predecessor && ` (${peers[r.predecessor]?.name} ↔ ${peers[r.successor || ""]?.name})`}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ELECTIONS TAB */}
        <TabsContent value="elections" className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" /> ROLE ELECTION (versioned, deterministic)
            </h4>
            <div className="flex gap-2 flex-wrap mb-4">
              {peerList.filter(p => p.status === "active" && p.role !== "explorer").map(p => (
                <Button key={p.nodeId} size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => triggerElection(p.nodeId)}>
                  👑 Elect {p.name}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              {elections.slice(-8).reverse().map((e, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className={`rounded-lg px-3 py-2 text-xs font-mono ${
                    e.status === "won" ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span>{peers[e.candidateId]?.name || e.candidateId}</span>
                    <span className={e.status === "won" ? "text-success" : "text-destructive"}>{e.status.toUpperCase()}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Votes: {e.votes.length}/{e.quorumNeeded} • Depth: {e.depth.toFixed(1)} • Version: {e.explorerVersion}
                  </div>
                </motion.div>
              ))}
              {elections.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No elections yet. Click a node above to trigger.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* STATE SYNC TAB */}
        <TabsContent value="state" className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3">VERSION-TRACKED STATE</h4>
            <div className="space-y-1">
              {Object.entries(managedState.entries).map(([key, entry]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-1.5 text-xs">
                  <span className="font-mono text-foreground">{key}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>v{entry.version}</span>
                    <span>by {peers[entry.updatedBy]?.name || entry.updatedBy}</span>
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
              {Object.keys(managedState.entries).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No shared state entries.</p>
              )}
            </div>
            <div className="mt-3">
              <h5 className="font-mono text-[10px] text-muted-foreground mb-1">LOCAL VERSION VECTOR</h5>
              <div className="font-mono text-[10px] text-muted-foreground">
                {JSON.stringify(managedState.localVersionVector)}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* LOG TAB */}
        <TabsContent value="log" className="mt-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="font-mono text-xs text-muted-foreground tracking-wider mb-3">
              COORDINATION LOG ({coordinationEvents.length} events)
            </h4>
            <ScrollArea className="h-72">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No coordination events yet.</p>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence>
                    {recentEvents.map((e) => (
                      <motion.div key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="flex items-start gap-2 text-[10px]">
                        <span className="shrink-0">{eventIcons[e.type] || "•"}</span>
                        <span className={`leading-relaxed ${
                          e.type.includes("dead") || e.type.includes("fail") ? "text-destructive" :
                          e.type.includes("success") || e.type.includes("won") || e.type.includes("merged") ? "text-success" :
                          e.type.includes("stale") || e.type.includes("partition_detected") ? "text-warning" :
                          "text-muted-foreground"
                        }`}>
                          {e.description}
                        </span>
                        <span className="ml-auto text-muted-foreground/50 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
