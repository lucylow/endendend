import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSwarmStore } from "@/store/swarmStore";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types";
import {
  Battery,
  Radio,
  MapPin,
  Zap,
  Target,
  ChevronRight,
  Users,
  Search,
  Box,
  AlertTriangle,
  Activity,
  ShieldAlert,
} from "lucide-react";

type RoleFilter = "all" | Agent["role"];
type SortKey = "name" | "battery" | "latency" | "stake" | "tasks";

function roleBadgeVariant(role: Agent["role"]): "default" | "secondary" | "outline" {
  if (role === "explorer") return "default";
  if (role === "relay") return "secondary";
  return "outline";
}

export default function AgentsPage() {
  const reduceMotion = useReducedMotion();
  const { agents, selectedAgentId, swarm, selectAgent } = useSwarmStore();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");

  const fleet = useMemo(() => {
    const n = agents.length;
    if (!n) {
      return {
        active: 0,
        avgBattery: 0,
        avgLatency: 0,
        totalStake: 0,
        attention: 0,
      };
    }
    const active = agents.filter((a) => a.status === "active").length;
    const avgBattery = agents.reduce((s, a) => s + a.battery, 0) / n;
    const avgLatency = agents.reduce((s, a) => s + a.latency, 0) / n;
    const totalStake = agents.reduce((s, a) => s + a.stakeAmount, 0);
    const attention = agents.filter(
      (a) => a.status !== "active" || a.battery < 22 || a.isByzantine,
    ).length;
    return { active, avgBattery, avgLatency, totalStake, attention };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = agents.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.currentBehavior.toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "battery":
          return b.battery - a.battery;
        case "latency":
          return a.latency - b.latency;
        case "stake":
          return b.stakeAmount - a.stakeAmount;
        case "tasks":
          return b.tasksCompleted - a.tasksCompleted;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return list;
  }, [agents, query, roleFilter, sortBy]);

  const metrics = [
    {
      icon: Users,
      label: "Fleet online",
      value: agents.length ? `${fleet.active}/${agents.length}` : "—",
      color: "text-primary",
    },
    {
      icon: Battery,
      label: "Avg battery",
      value: agents.length ? `${fleet.avgBattery.toFixed(0)}%` : "—",
      color: "text-success",
    },
    {
      icon: Zap,
      label: "Avg latency",
      value: agents.length ? `${fleet.avgLatency.toFixed(0)}ms` : "—",
      color: "text-accent",
    },
    {
      icon: Radio,
      label: "Fleet stake",
      value: agents.length ? `$${fleet.totalStake.toLocaleString()}` : "—",
      color: "text-primary",
    },
    {
      icon: fleet.attention ? AlertTriangle : Activity,
      label: "Attention",
      value: agents.length ? `${fleet.attention} unit${fleet.attention === 1 ? "" : "s"}` : "—",
      color: fleet.attention ? "text-amber-500" : "text-muted-foreground",
    },
  ];

  const listItemTransition = (delayIndex: number) =>
    reduceMotion ? { duration: 0 } : { delay: Math.min(delayIndex * 0.04, 0.35) };
  const metricTransition = (delayIndex: number) =>
    reduceMotion ? { duration: 0 } : { delay: delayIndex * 0.05 };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Agent fleet</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every unit on <span className="text-foreground font-medium">{swarm.name}</span> runs the same consensus
            stack: FoxMQ for mesh fan-out, Vertex for BFT checkpoints, and a local policy engine for role handoffs.
            Open a dossier for narrative copy, live telemetry, and the miniature context scene — tuned for walkthroughs
            and ops review.
          </p>
        </div>
        <Link
          to="/swarm"
          className="rounded-xl border border-border/80 bg-card/40 px-4 py-3 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card/60 font-mono max-w-xs self-start md:self-end"
        >
          <div className="text-[10px] uppercase tracking-widest text-primary/90 mb-1 flex items-center gap-1.5">
            <Box className="h-3.5 w-3.5" />
            Spatial context
          </div>
          View agents in the 3D swarm canvas — selection stays in sync with this roster.
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={metricTransition(i)}
          >
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, id, or behavior…"
            className="pl-9 bg-background/80"
            aria-label="Filter agents"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:justify-between sm:gap-3">
          <p className="text-xs text-muted-foreground tabular-nums sm:order-last sm:shrink-0" aria-live="polite">
            {agents.length
              ? `Showing ${filteredAgents.length} of ${agents.length} agent${agents.length === 1 ? "" : "s"}`
              : null}
          </p>
          <ToggleGroup
            type="single"
            value={roleFilter}
            onValueChange={(v) => setRoleFilter((v || "all") as RoleFilter)}
            variant="outline"
            size="sm"
            className="justify-start flex-wrap"
            aria-label="Filter by role"
          >
            <ToggleGroupItem value="all" className="text-xs px-3">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="explorer" className="text-xs px-3 capitalize">
              Explorer
            </ToggleGroupItem>
            <ToggleGroupItem value="relay" className="text-xs px-3 capitalize">
              Relay
            </ToggleGroupItem>
            <ToggleGroupItem value="standby" className="text-xs px-3 capitalize">
              Standby
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background/80" aria-label="Sort agents">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="battery">Battery (high first)</SelectItem>
              <SelectItem value="latency">Latency (low first)</SelectItem>
              <SelectItem value="stake">Stake (high first)</SelectItem>
              <SelectItem value="tasks">Tasks completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!agents.length ? (
        <Card className="bg-card/50 border-border border-dashed">
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
            <p>No agents in the swarm store yet. Start a simulation from the overview or live simulation page.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/metrics">Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !filteredAgents.length ? (
        <Card className="bg-card/50 border-border border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">No agents match your filters.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setRoleFilter("all");
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={listItemTransition(i)}
            >
              <Link
                to="/drones/$id"
                params={{ id: agent.id }}
                className="block group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => selectAgent(agent.id)}
              >
                <Card
                  className={`bg-card/50 border-border card-hover h-full transition-colors group-hover:border-primary/35 ${
                    selectedAgentId === agent.id ? "border-primary/50 glow-cyan" : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-background"
                          style={{ backgroundColor: agent.color }}
                        />
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                          <p className="text-[10px] font-mono text-muted-foreground capitalize mt-0.5 truncate">
                            {agent.currentBehavior}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant={roleBadgeVariant(agent.role)}
                          className="text-[10px] capitalize whitespace-nowrap"
                        >
                          {agent.role}
                        </Badge>
                        {agent.isByzantine ? (
                          <Badge variant="destructive" className="text-[9px] gap-0.5 px-1.5 py-0">
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Byzantine
                          </Badge>
                        ) : null}
                      </div>
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
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {agent.battery.toFixed(0)}%
                        </span>
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                          <MapPin className="w-3 h-3" />
                          <span className="text-[10px] font-mono">Position</span>
                        </div>
                        <span className="font-mono text-[10px] text-foreground text-right tabular-nums">
                          ({agent.position.x.toFixed(1)}, {agent.position.y.toFixed(1)},{" "}
                          {agent.position.z.toFixed(1)})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Target className="w-3 h-3" />
                          <span className="text-[10px] font-mono">Tasks done</span>
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            agent.status === "active"
                              ? "bg-success animate-pulse-glow"
                              : agent.status === "low-battery"
                                ? "bg-amber-500"
                                : "bg-destructive"
                          }`}
                        />
                        <span className="text-[10px] font-mono text-muted-foreground capitalize truncate">
                          {agent.status.replace("-", " ")}
                        </span>
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
      )}
    </div>
  );
}
