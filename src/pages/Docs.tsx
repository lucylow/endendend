import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Code, Cpu, Radio, Shield, Zap, Activity, Lock,
  GitBranch, Layers, Target, Network, FileCode, ChevronRight, ArrowLeft,
  Box, MessageSquare, Database, Settings, TestTube
} from "lucide-react";

type TabId = "overview" | "architecture" | "scenarios" | "api" | "config";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "scenarios", label: "Scenarios", icon: Target },
  { id: "api", label: "API & Messages", icon: MessageSquare },
  { id: "config", label: "Configuration", icon: Settings },
];

const overviewSections = [
  { icon: Cpu, title: "Agent Architecture", content: "Each agent runs a lightweight consensus node that participates in role election, task bidding, and relay chain formation. Agents assume three roles: Explorer (forward scout), Relay (communication bridge), and Standby (reserve)." },
  { icon: Radio, title: "Relay Chain Protocol", content: "When signal strength drops below threshold, agents autonomously insert relay nodes to maintain the communication chain. The system tolerates up to 90% packet loss through adaptive store-and-forward." },
  { icon: Shield, title: "Stake-Weighted Trust", content: "Agents stake $TASHI tokens proportional to task value. Higher stakes increase trust scores, giving priority in task auctions. Malicious behavior results in slashing." },
  { icon: Zap, title: "Task Auction System", content: "Tasks are published to the swarm mesh. Agents submit distance-based bids. Winners are selected by proximity, battery level, and trust score." },
  { icon: Activity, title: "Observability", content: "Structured event logging, per-link network metrics, real-time WebSocket telemetry, and a React dashboard with 3D visualization." },
  { icon: Lock, title: "Security & Keying", content: "Session key rotation per sortie. JWTs bound to hardware attestation. Staking transactions require multi-factor approval in production." },
];

const architectureLayers = [
  { name: "Behavior Layer", desc: "Exploration, rescue, relay holding", modules: ["DroneController", "ExplorationManager", "TargetManager"], color: "text-emerald-400" },
  { name: "Coordination Layer", desc: "Role management, consensus, task allocation", modules: ["ChainManager", "BFT Engine", "Sector Manager"], color: "text-cyan-400" },
  { name: "Messaging Layer", desc: "P2P broadcast, reliable delivery", modules: ["VertexNode", "NetworkEmulator", "ReliableSender"], color: "text-sky-400" },
  { name: "Simulation Layer", desc: "Webots integration, mock robots", modules: ["DroneController.run()", "SimpleMockRobot", "NetworkSimulator"], color: "text-violet-400" },
];

const messageTypes = [
  { type: "EXPLORATION_UPDATE", dir: "Broadcast", purpose: "Share explored cells and claims", category: "exploration" },
  { type: "VICTIM_DETECTED", dir: "Broadcast", purpose: "Raw sensor detection event", category: "target" },
  { type: "TARGET_ANNOUNCEMENT", dir: "Broadcast", purpose: "Confirmed target with ID and location", category: "target" },
  { type: "TARGET_CLAIM", dir: "Broadcast", purpose: "Distance-based bid for rescue assignment", category: "target" },
  { type: "TARGET_RESOLVED", dir: "Broadcast", purpose: "Target rescued, remove from tracking", category: "target" },
  { type: "TARGET_UPDATE", dir: "Broadcast", purpose: "Updated target state (reassignment)", category: "target" },
  { type: "HEARTBEAT", dir: "Broadcast", purpose: "Peer liveness detection", category: "network" },
  { type: "ROLE_ANNOUNCE", dir: "Broadcast", purpose: "Role change notification", category: "roles" },
  { type: "REALLOCATION_PROPOSAL", dir: "Broadcast", purpose: "Dead rover id + proposed sector bounds for all survivors", category: "sectors" },
  { type: "VOTE_ACCEPT", dir: "Unicast", purpose: "Accept reallocation proposal (quorum / majority)", category: "sectors" },
  { type: "VOTE_REJECT", dir: "Unicast", purpose: "Reject invalid or unfair proposal", category: "sectors" },
  { type: "SECTOR_UPDATE", dir: "Broadcast", purpose: "Committed bounds for one rover after reallocation", category: "sectors" },
];

const scenarios = [
  {
    title: "Dynamic Daisy Chain",
    icon: GitBranch,
    description: "Drones form a self-healing relay chain through a tunnel. As the explorer advances, relays are inserted to maintain connectivity.",
    steps: [
      "One drone elected as Explorer (deepest depth)",
      "Explorer moves beyond 8m from last relay → Standby promoted to Relay",
      "Chain grows: Base ← Relay₁ ← Relay₂ ← Explorer",
      "If a Relay fails, neighbors detect via 5s heartbeat timeout and re-link",
    ],
  },
  {
    title: "Fallen Comrade",
    icon: Target,
    description: "When a rover dies, its search sector is redistributed among survivors via gossip consensus — no central coordinator.",
    steps: [
      "5 rovers each assigned a grid sector",
      "Rover failure detected within 5s (heartbeat timeout)",
      "Dead rover's sector split among neighbors via gossip",
      "BFT consensus confirms reallocation (tolerates 1 Byzantine in 5)",
    ],
  },
  {
    title: "Blind Handoff",
    icon: Network,
    description: "Aerial drone detects a victim but has low battery. Ground rovers bid based on distance to claim the rescue.",
    steps: [
      "Aerial detects victim → broadcasts TARGET_ANNOUNCEMENT",
      "Ground rovers calculate distance → broadcast TARGET_CLAIM",
      "Closest rover wins (tie-break: lexicographic ID)",
      "Winner navigates to victim → broadcasts TARGET_RESOLVED",
    ],
  },
];

const configSections = [
  { file: "swarm/config.py", desc: "Python: grid size, drone speed, victim positions, FoxMQ broker", icon: FileCode },
  { file: "src/config/foxmq.ts", desc: "TypeScript: broker host/port, cluster name, replication factor", icon: Code },
  { file: "src/config/swarmRobustness.ts", desc: "TypeScript: heartbeat intervals, peer timeouts, relay distance", icon: Settings },
  { file: "config/default.yaml", desc: "YAML: full scenario-level parameter overrides", icon: Database },
];

const codeModules = [
  { path: "swarm/vertex_node.py", desc: "Single-hop P2P broadcast abstraction" },
  { path: "swarm/chain_manager.py", desc: "Role assignment and message routing" },
  { path: "swarm/exploration.py", desc: "Gossip-based grid exploration with claims" },
  { path: "swarm/target_manager.py", desc: "Victim detection and distance-based claiming" },
  { path: "swarm/drone_controller.py", desc: "Main control loop: explore → detect → rescue" },
  { path: "swarm/network_simulator.py", desc: "Per-link loss/latency and scenario timelines" },
  { path: "swarm/network_emulator.py", desc: "Fanout delivery with loss model" },
  { path: "swarm/persist.py", desc: "Snapshot and restore exploration state" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Home</span>
            </Link>
            <span className="text-border mx-2">|</span>
            <span className="text-primary text-lg">◆</span>
            <span className="font-semibold text-foreground text-sm">Tashi Docs</span>
          </div>
          <Button size="sm" className="rounded-full text-xs" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-20">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
          <span className="font-mono text-[10px] text-primary tracking-[0.25em] uppercase">Documentation</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">Tashi Swarm Protocol</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Technical reference for the decentralized swarm coordination system. Architecture, message formats, scenarios, and configuration.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "architecture" && <ArchitectureTab />}
            {activeTab === "scenarios" && <ScenariosTab />}
            {activeTab === "api" && <ApiTab />}
            {activeTab === "config" && <ConfigTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-4">
      {overviewSections.map((s) => (
        <Card key={s.title} className="bg-card/50 border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <s.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1">{s.title}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.content}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ArchitectureTab() {
  return (
    <div className="space-y-8">
      {/* Layer Stack */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-4">System Layers</h2>
        <div className="space-y-2">
          {architectureLayers.map((layer, i) => (
            <div key={layer.name} className="rounded-lg border border-border/60 bg-card/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-semibold ${layer.color}`}>{layer.name}</h3>
                <span className="text-[10px] text-muted-foreground font-mono">Layer {architectureLayers.length - i}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{layer.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {layer.modules.map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded bg-muted/60 text-[10px] font-mono text-foreground">{m}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Data Flow: Target Claim</h2>
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
          {[
            "Drone A detects victim at (75, 75, 0) — confidence > 0.7",
            "Creates Target → broadcasts TARGET_ANNOUNCEMENT to mesh",
            "Drone A calculates own distance → broadcasts TARGET_CLAIM",
            "Drone B receives announcement → calculates distance → if closer, broadcasts competing CLAIM",
            "Closest drone wins (tie-break: lexicographic node ID)",
            "Winner transitions to \"rescue\" behavior → navigates to victim",
            "On arrival → broadcasts TARGET_RESOLVED → all peers remove target",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-mono flex items-center justify-center">{i + 1}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Module Reference */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Module Reference</h2>
        <div className="grid gap-2">
          {codeModules.map((mod) => (
            <div key={mod.path} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-4 py-2.5">
              <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <code className="text-[11px] font-mono text-primary min-w-[180px]">{mod.path}</code>
              <span className="text-xs text-muted-foreground">{mod.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenariosTab() {
  return (
    <div className="space-y-4">
      {scenarios.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.title} className="bg-card/50 border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{s.description}</p>
                  <div className="space-y-1.5">
                    {s.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                        <span className="text-[11px] text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Try it live:</span>{" "}
            Navigate to{" "}
            <Link to="/scenarios/search-rescue" className="text-primary underline underline-offset-2">/scenarios/search-rescue</Link>{" "}
            for interactive demos (15 SAR scenarios, including Fallen Comrade).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ApiTab() {
  const categories = [...new Set(messageTypes.map((m) => m.category))];
  const catLabels: Record<string, string> = {
    exploration: "Exploration",
    target: "Target / Rescue",
    network: "Network",
    roles: "Roles",
    sectors: "Sectors / Reallocation",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">Message Protocol</h2>
        <p className="text-xs text-muted-foreground mb-4">All messages are JSON, broadcast via VertexNode to all peers. No request-response — purely event-driven gossip.</p>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{catLabels[cat] || cat}</h3>
          <div className="space-y-1.5">
            {messageTypes.filter((m) => m.category === cat).map((m) => (
              <div key={m.type} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-4 py-2.5">
                <code className="text-[11px] font-mono text-primary font-semibold min-w-[180px]">{m.type}</code>
                <span className="text-[10px] text-muted-foreground/70 font-mono min-w-[70px]">{m.dir}</span>
                <span className="text-xs text-muted-foreground">{m.purpose}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h3 className="text-xs font-semibold text-foreground mb-2">WebSocket Telemetry</h3>
        <p className="text-xs text-muted-foreground mb-2">The frontend connects via <code className="text-primary">ws://localhost:8080/telemetry</code> and receives:</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Box className="w-3 h-3 text-cyan-400" />
            <code className="text-[10px] font-mono text-muted-foreground">{"{ type: 'telemetry', agents: AgentTelemetry[] }"}</code>
          </div>
          <div className="flex items-center gap-2">
            <Box className="w-3 h-3 text-emerald-400" />
            <code className="text-[10px] font-mono text-muted-foreground">{"{ type: 'swarm_status', ... }"}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">Configuration Files</h2>
        <p className="text-xs text-muted-foreground mb-4">Parameters are tunable via files and environment variables — no code changes needed.</p>
      </div>

      <div className="space-y-2">
        {configSections.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.file} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-4 py-3">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <code className="text-[11px] font-mono text-primary">{c.file}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h3 className="text-xs font-semibold text-foreground mb-2">Environment Variables</h3>
        <div className="space-y-1.5 font-mono text-[10px]">
          {[
            ["VITE_FOXMQ_HOST", "FoxMQ broker hostname"],
            ["VITE_FOXMQ_PORT", "FoxMQ broker port"],
            ["VITE_SWARM_WS_URL", "WebSocket telemetry endpoint"],
            ["VITE_FOXMQ_CLUSTER_NAME", "Cluster name for partitioning"],
            ["SWARM_EXPLORATION_PATH", "Exploration state persistence path"],
          ].map(([name, desc]) => (
            <div key={name} className="flex items-center gap-3">
              <code className="text-primary min-w-[200px]">{name}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h3 className="text-xs font-semibold text-foreground mb-2">Testing</h3>
        <div className="space-y-2">
          {[
            { cmd: "pytest swarm/tests/", desc: "Python unit tests (exploration, network, targets)" },
            { cmd: "npm test", desc: "Frontend Vitest tests" },
            { cmd: "PYTHONPATH=. python swarm/demo_mesh_http.py", desc: "Headless multi-drone simulation" },
          ].map((t) => (
            <div key={t.cmd} className="flex items-start gap-2">
              <TestTube className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <code className="text-[10px] text-primary">{t.cmd}</code>
                <p className="text-[10px] text-muted-foreground">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
