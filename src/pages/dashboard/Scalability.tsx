import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwarmStore } from "@/store/swarmStore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";

/** Illustrative scaling curve; replace with live WS when backend streams `scalability_snapshot`. */
const DEMO_SCALING = [
  { n: 10, broadcastPerNode: 9, gossipPerNode: 3.2 },
  { n: 20, broadcastPerNode: 19, gossipPerNode: 3.4 },
  { n: 50, broadcastPerNode: 49, gossipPerNode: 3.5 },
  { n: 100, broadcastPerNode: 99, gossipPerNode: 3.6 },
];

export default function ScalabilityPage() {
  const agents = useSwarmStore((s) => s.agents);

  const chartData = useMemo(
    () =>
      DEMO_SCALING.map((row) => ({
        nodes: row.n,
        "Full broadcast (O(n) edges/node)": row.broadcastPerNode,
        "Gossip + sampled fan-out": row.gossipPerNode,
      })),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-5 w-5" />
            <span className="text-xs font-mono uppercase tracking-widest">Scalability</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Network growth</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Vertex uses bounded gossip (constant fan-out), epidemic exploration relays above{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">SCALABLE_PEER_COUNT_THRESHOLD</code>, adaptive
            distance-vector periods, optional PBFT committees, and rendezvous target assignment — so total control traffic
            stays near-linear instead of quadratic as the fleet grows.
          </p>
        </div>
        <Card className="border-border/80 bg-card/50 max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground tracking-wider">LIVE FLEET</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono text-emerald-400">{agents.length}</p>
            <p className="text-xs text-muted-foreground mt-1">agents in UI store (telemetry)</p>
          </CardContent>
        </Card>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">
              OUTBOUND MESSAGES / NODE / TICK (ILLUSTRATIVE)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" opacity={0.5} />
                <XAxis dataKey="nodes" tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} label={{ value: "Nodes", position: "insideBottom", offset: -4, fill: "hsl(215, 15%, 50%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 10%)",
                    border: "1px solid hsl(220, 15%, 18%)",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Full broadcast (O(n) edges/node)" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Gossip + sampled fan-out" fill="#2dd4bf" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-3 font-mono">
              Measure your build:{" "}
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                PYTHONPATH=. python swarm/run_scalability_test.py --sizes 10 20 50 100 --seconds 3 --csv out.csv
              </code>
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/80 bg-card/40">
          <CardHeader>
            <CardTitle className="text-sm">Python tuning knobs</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 font-mono leading-relaxed">
            <p>
              <span className="text-foreground">GOSSIP_FANOUT</span>, <span className="text-foreground">GOSSIP_INTERVAL_SEC</span>{" "}
              — peer discovery cost per node.
            </p>
            <p>
              <span className="text-foreground">HEARTBEAT_FANOUT</span> + <span className="text-foreground">SCALABLE_PEER_COUNT_THRESHOLD</span>{" "}
              — sampled heartbeats on large swarms.
            </p>
            <p>
              <span className="text-foreground">EXPLORATION_GOSSIP_FANOUT</span>, <span className="text-foreground">EXPLORATION_RELAY_TTL</span>{" "}
              — epidemic map sync.
            </p>
            <p>
              <span className="text-foreground">PBFT_COMMITTEE_SIZE</span>, <span className="text-foreground">ROUTING_MAX_ADVERTISE_DESTS</span>{" "}
              — cap consensus and DV table pressure.
            </p>
            <p>
              <span className="text-foreground">TARGET_USE_RENDEZVOUS_CLAIM</span> — SHA-256 rendezvous winner per task id.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/40">
          <CardHeader>
            <CardTitle className="text-sm">Per-node metrics</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            <p>
              Each <code className="bg-muted px-1 rounded">VertexNode</code> exposes{" "}
              <code className="bg-muted px-1 rounded">scalability_snapshot()</code> (outbound totals and windowed rate) for dashboards or logging.
              Safety traffic still uses full flood / broadcast with <code className="bg-muted px-1 rounded">priority=high</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
