import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSwarmStore } from "@/store/swarmStore";
import { ShieldCheck, Users, Activity, AlertTriangle, Server, Database } from "lucide-react";

export default function AdminPage() {
  const { agents, tasks, swarm } = useSwarmStore();

  const systemHealth = [
    { icon: Server, label: "P2P Mesh", status: "healthy", uptime: "99.97%" },
    { icon: Database, label: "Blockchain Node", status: "healthy", uptime: "99.99%" },
    { icon: Activity, label: "Consensus Engine", status: "healthy", uptime: "99.95%" },
    { icon: AlertTriangle, label: "Alert System", status: "warning", uptime: "98.50%" },
  ];

  return (
    <div className="min-h-screen bg-background bg-grid">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground text-sm">Admin Panel</span>
          </div>
          <Badge variant="destructive" className="text-[10px]">ADMIN ACCESS</Badge>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">System administration</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fleet-wide health, synthetic uptimes, and break-glass controls. This route is styled for trusted operators —
            pair it with your real identity provider; the UI is intentionally stark so incidents stand out on a wall
            display.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Agents", value: agents.length, icon: Users },
            { label: "Active Tasks", value: tasks.filter((t) => t.status !== "completed").length, icon: Activity },
            { label: "Swarm Status", value: swarm.status, icon: Server },
            { label: "Alerts", value: 1, icon: AlertTriangle },
          ].map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="bg-card/50 border-border">
                <CardContent className="p-4">
                  <m.icon className="w-5 h-5 text-primary mb-2" />
                  <div className="font-mono text-xl font-bold text-foreground capitalize">{m.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{m.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">SYSTEM HEALTH</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {systemHealth.map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <s.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{s.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground">{s.uptime}</span>
                  <Badge variant={s.status === "healthy" ? "default" : "destructive"} className="text-[10px] capitalize">
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" size="sm">Export Logs</Button>
          <Button variant="outline" size="sm">Restart Mesh</Button>
          <Button variant="destructive" size="sm">Emergency Shutdown</Button>
        </div>
      </div>
    </div>
  );
}
