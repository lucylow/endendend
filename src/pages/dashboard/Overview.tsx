import { motion } from "framer-motion";
import { Activity, Battery, Radio, Cpu, Zap, Users, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwarmStore } from "@/store/swarmStore";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useMissions } from "@/hooks/useMissions";
import CreateMissionDialog from "@/components/CreateMissionDialog";
import MissionList from "@/components/MissionList";

export default function DashboardOverview() {
  const { agents, tasks, swarm, totalStaked, rewardsEarned } = useSwarmStore();
  const { user } = useAuth();
  const { missions } = useMissions();

  const avgBattery = agents.length ? agents.reduce((sum, a) => sum + a.battery, 0) / agents.length : 0;
  const avgLatency = agents.length ? agents.reduce((sum, a) => sum + a.latency, 0) / agents.length : 0;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const activeMissions = missions.filter((m) => m.status === "active").length;

  const metrics = [
    { icon: Users, label: "Active Agents", value: `${activeAgents}/${agents.length}`, color: "text-primary" },
    { icon: Battery, label: "Avg Battery", value: `${avgBattery.toFixed(0)}%`, color: "text-success" },
    { icon: Zap, label: "Avg Latency", value: `${avgLatency.toFixed(0)}ms`, color: "text-accent" },
    { icon: Activity, label: "Tasks Done", value: `${completedTasks}/${tasks.length}`, color: "text-primary" },
    { icon: Rocket, label: "Active Missions", value: `${activeMissions}`, color: "text-primary" },
    { icon: Radio, label: "Total Staked", value: `$${totalStaked.toLocaleString()}`, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Swarm overview</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Real-time status for <span className="text-foreground font-medium">{swarm.name}</span>.
          {user ? " Connected to live backend — missions and telemetry update in real-time." : " Running in demo mode with mock telemetry."}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="bg-card/50 border-border card-hover">
              <CardContent className="p-4">
                <m.icon className={`w-5 h-5 ${m.color} mb-2`} />
                <div className="font-mono text-xl font-bold text-foreground">{m.value}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{m.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Missions Section — Live from Cloud */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">MISSIONS (LIVE)</CardTitle>
          {user && <CreateMissionDialog />}
        </CardHeader>
        <CardContent>
          <MissionList />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent List */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">AGENT ROSTER</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
                  <div>
                    <div className="text-sm font-medium text-foreground">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize font-mono">{agent.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-20">
                    <Progress value={agent.battery} className="h-1.5" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground w-12 text-right">{agent.battery.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">ACTIVE TASKS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{task.title}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    task.priority === "critical" ? "bg-destructive/20 text-destructive" :
                    task.priority === "high" ? "bg-accent/20 text-accent" :
                    "bg-primary/20 text-primary"
                  }`}>{task.priority}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground capitalize font-mono">{task.status}</span>
                  <span className="font-mono text-xs text-primary">{task.reward} $TASHI</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
