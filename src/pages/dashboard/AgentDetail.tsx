import { useEffect } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Battery,
  Cpu,
  MapPin,
  Radio,
  Shield,
  Skull,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSwarmStore } from "@/store/swarmStore";
import SwarmScene from "@/components/SwarmScene";

export default function AgentDetailPage() {
  const { id: rawId } = useParams({ strict: false });
  const id = typeof rawId === "string" ? rawId : undefined;
  const { agents, tasks, selectAgent } = useSwarmStore();
  const agent = agents.find((a) => a.id === id);

  useEffect(() => {
    selectAgent(id ?? null);
    return () => selectAgent(null);
  }, [id, selectAgent]);

  if (!agent) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
          <Link to="/drones">
            <ArrowLeft className="h-4 w-4" />
            Back to agents
          </Link>
        </Button>
        <Card className="border-border bg-card/50">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-lg font-medium text-foreground">No agent matches this dossier ID.</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The link may be stale, or the unit was rotated out of the active roster. Return to the fleet grid to pick
              another callsign.
            </p>
            <Button asChild className="mt-2">
              <Link to="/drones">View all agents</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const relatedTasks = tasks.filter((t) => t.assignedAgent === agent.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 w-fit" asChild>
            <Link to="/drones">
              <ArrowLeft className="h-4 w-4" />
              Fleet roster
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: agent.color }} />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{agent.name}</h1>
            <Badge variant={agent.role === "explorer" ? "default" : "secondary"} className="capitalize font-mono text-[10px]">
              {agent.role}
            </Badge>
            {agent.isByzantine ? (
              <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
                <Skull className="h-3 w-3" />
                Byzantine (sim)
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Live dossier for a single swarm unit. Telemetry below mirrors the same store that drives the 3D simulation —
            battery slope, mesh latency, stake weighting, and behavior state update together so operators can explain every
            decision during a demo or post-incident replay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full shrink-0 ${agent.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`}
          />
          <span className="text-xs font-mono text-muted-foreground capitalize">{agent.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 space-y-4"
        >
          <Card className="border-border bg-card/40 overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">CONTEXT VIEW</CardTitle>
              <p className="text-xs text-muted-foreground font-normal leading-relaxed pt-1">
                Miniature scene uses the shared swarm renderer — scrub missions on the replay page to correlate motion with
                this agent&apos;s trail.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <SwarmScene className="w-full h-[280px] sm:h-[320px]" animate />
            </CardContent>
          </Card>

          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Field notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                <span className="text-foreground font-medium">Role:</span>{" "}
                {agent.role === "explorer" && "Forward element — extends the mesh, publishes discovery beacons, and pulls high-value tasks first in auctions."}
                {agent.role === "relay" && "Backbone node — prioritizes store-and-forward throughput and stabilizes consensus rounds when depth or packet loss spikes."}
                {agent.role === "standby" && "Reserve capacity — hot-standby for promotion when a relay drops or the explorer needs relief."}
              </p>
              <p>
                <span className="text-foreground font-medium">Behavior:</span>{" "}
                <span className="font-mono text-xs text-teal-300/90">{agent.currentBehavior}</span>
                {agent.targetId ? (
                  <>
                    {" "}
                    — tracking target <span className="font-mono text-foreground/80">{agent.targetId}</span>.
                  </>
                ) : null}
              </p>
              <p className="text-xs border-l-2 border-primary/30 pl-3">
                Stake-weighted trust influences auction priority: higher on-chain commitment signals operational seriousness
                and lowers perceived slashing risk for mission planners.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <Card className="border-border bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">TELEMETRY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Battery className="h-3.5 w-3.5" />
                    Battery
                  </span>
                  <span className="font-mono text-foreground">{agent.battery.toFixed(0)}%</span>
                </div>
                <Progress value={agent.battery} className="h-2" />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Zap className="h-3.5 w-3.5" />
                  Mesh RTT
                </span>
                <span className="font-mono text-sm font-semibold text-primary">{agent.latency.toFixed(0)} ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Target className="h-3.5 w-3.5" />
                  Tasks completed
                </span>
                <span className="font-mono text-sm text-foreground">{agent.tasksCompleted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Radio className="h-3.5 w-3.5" />
                  Stake (demo)
                </span>
                <span className="font-mono text-sm text-primary">${agent.stakeAmount}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono shrink-0">
                  <MapPin className="h-3.5 w-3.5" />
                  Position
                </span>
                <span className="font-mono text-[11px] text-right text-foreground/90">
                  ({agent.position.x.toFixed(2)}, {agent.position.y.toFixed(2)}, {agent.position.z.toFixed(2)})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Cpu className="h-3.5 w-3.5" />
                  Consensus exposure
                </span>
                <span className="text-xs text-muted-foreground">Vertex + FoxMQ path</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Shield className="h-3.5 w-3.5" />
                  Integrity
                </span>
                <span className="text-xs">{agent.isByzantine ? "Flagged in sim" : "Honest profile"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">ASSIGNED TASKS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {relatedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No direct assignments in the mock ledger. Open task auctions to bid this unit into a mission.
                </p>
              ) : (
                relatedTasks.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">{t.title}</div>
                    <div className="text-[10px] font-mono text-muted-foreground capitalize mt-0.5">{t.status}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
