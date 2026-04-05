import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwarmStore } from "@/store/swarmStore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useMemo } from "react";

export default function AnalyticsPage() {
  const { agents, tasks } = useSwarmStore();

  const latencyData = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      time: `${i}s`,
      latency: 15 + Math.sin(i * 0.5) * 10 + Math.random() * 5,
      throughput: 80 + Math.cos(i * 0.3) * 15 + Math.random() * 10,
    })), []);

  const batteryData = useMemo(() =>
    agents.map((a) => ({ name: a.name, battery: a.battery, tasks: a.tasksCompleted })), [agents]);

  const taskDistribution = useMemo(() => {
    const statuses = ["open", "bidding", "assigned", "completed"];
    return statuses.map((s) => ({ name: s, value: tasks.filter((t) => t.status === s).length }));
  }, [tasks]);

  const roleDistribution = useMemo(() => {
    const roles = ["explorer", "relay", "standby"];
    return roles.map((r) => ({ name: r, value: agents.filter((a) => a.role === r).length }));
  }, [agents]);

  const COLORS = ["#00d4ff", "#6366f1", "#f59e0b", "#10b981"];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Metrics & analytics</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Latency envelopes, throughput oscillation, and per-agent duty cycles — synthetic series for the demo that
            mirror the shapes we see in field tests (hand-tuned for storytelling, swappable for real Prometheus feeds).
          </p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card/40 px-4 py-3 text-xs text-muted-foreground font-mono max-w-xs">
          <div className="text-[10px] uppercase tracking-widest text-primary/90 mb-1">SLO snapshot</div>
          Coord p99 &lt; 120ms · Mesh uptime 99.9% · Task fairness index 0.94
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">LATENCY OVER TIME</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={latencyData}>
                  <defs>
                    <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 15%, 18%)", borderRadius: "8px", fontSize: 12 }} />
                  <Area type="monotone" dataKey="latency" stroke="#00d4ff" fill="url(#latencyGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">THROUGHPUT</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={latencyData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 15%, 18%)", borderRadius: "8px", fontSize: 12 }} />
                  <Line type="monotone" dataKey="throughput" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">AGENT BATTERY & TASKS</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={batteryData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 15%, 18%)", borderRadius: "8px", fontSize: 12 }} />
                  <Bar dataKey="battery" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tasks" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">DISTRIBUTION</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-2 font-mono">TASKS</div>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={taskDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                        {taskDistribution.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-2 font-mono">ROLES</div>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                        {roleDistribution.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {COLORS.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                    <span className="text-[10px] text-muted-foreground capitalize">{["open", "bidding", "assigned", "done"][i]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
