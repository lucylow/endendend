import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwarmStore } from "@/store/swarmStore";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Battery, Radio, MapPin, Zap, Target, ChevronRight } from "lucide-react";

export default function AgentsPage() {
  const { agents, selectedAgentId } = useSwarmStore();

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Agent fleet</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every unit carries the same consensus stack: FoxMQ for mesh fan-out, Vertex for BFT checkpoints, and a local
          policy engine for role handoffs. Open a dossier for narrative copy, live telemetry, and the miniature context
          scene — ideal for investor walkthroughs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map((agent, i) => (
          <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/dashboard/agents/${agent.id}`} className="block group">
            <Card className={`bg-card/50 border-border card-hover h-full transition-colors group-hover:border-primary/35 ${selectedAgentId === agent.id ? "border-primary/50 glow-cyan" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agent.color }} />
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                  </div>
                  <Badge variant={agent.role === "explorer" ? "default" : "secondary"} className="text-[10px] capitalize">
                    {agent.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Battery className="w-3 h-3" />
                      <span className="text-[10px] font-mono">Battery</span>
                    </div>
                    <Progress value={agent.battery} className="h-1.5" />
                    <span className="text-[10px] font-mono text-muted-foreground">{agent.battery.toFixed(0)}%</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="w-3 h-3" />
                      <span className="text-[10px] font-mono">Latency</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-primary">{agent.latency.toFixed(0)}ms</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span className="text-[10px] font-mono">Position</span>
                    </div>
                    <span className="font-mono text-[10px] text-foreground">
                      ({agent.position.x.toFixed(1)}, {agent.position.y.toFixed(1)}, {agent.position.z.toFixed(1)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Target className="w-3 h-3" />
                      <span className="text-[10px] font-mono">Tasks Done</span>
                    </div>
                    <span className="font-mono text-sm text-foreground">{agent.tasksCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Radio className="w-3 h-3" />
                      <span className="text-[10px] font-mono">Stake</span>
                    </div>
                    <span className="font-mono text-sm text-primary">${agent.stakeAmount}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${agent.status === "active" ? "bg-success animate-pulse-glow" : "bg-destructive"}`} />
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{agent.status}</span>
                  </div>
                  <span className="flex items-center gap-0.5 text-[10px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Dossier
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
