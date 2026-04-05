import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Drone {
  id: number;
  x: number;
  y: number;
  role: "explorer" | "relay" | "standby";
  signalStrength: number;
  depth: number;
  alive: boolean;
}

interface Message {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  type: "data" | "heartbeat" | "alert";
}

const TUNNEL_WIDTH = 900;
const TUNNEL_HEIGHT = 200;
const DRONE_COUNT = 6;

const roleColors: Record<string, string> = {
  explorer: "hsl(185, 80%, 50%)",
  relay: "hsl(200, 90%, 60%)",
  standby: "hsl(215, 15%, 40%)",
};

const roleLabelColors: Record<string, string> = {
  explorer: "text-primary",
  relay: "text-primary/80",
  standby: "text-muted-foreground",
};

export default function RelayChainDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [simPhase, setSimPhase] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>(["System idle. Press START to begin simulation."]);
  const phaseRef = useRef(0);
  const dronesRef = useRef<Drone[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const msgIdRef = useRef(0);
  const tickRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    setStatusLog((prev) => [msg, ...prev].slice(0, 8));
  }, []);

  const initDrones = useCallback(() => {
    const d: Drone[] = [];
    for (let i = 0; i < DRONE_COUNT; i++) {
      d.push({
        id: i,
        x: 80 + i * 20,
        y: TUNNEL_HEIGHT / 2 + (Math.random() - 0.5) * 40,
        role: "standby",
        signalStrength: 1,
        depth: 0,
        alive: true,
      });
    }
    dronesRef.current = d;
    setDrones([...d]);
  }, []);

  const startSimulation = useCallback(() => {
    initDrones();
    setIsRunning(true);
    phaseRef.current = 1;
    setSimPhase(1);
    tickRef.current = 0;
    messagesRef.current = [];
    setMessages([]);
    addLog("▶ Simulation started. Drones deploying...");
  }, [initDrones, addLog]);

  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    phaseRef.current = 0;
    setSimPhase(0);
    tickRef.current = 0;
    messagesRef.current = [];
    setMessages([]);
    initDrones();
    setStatusLog(["System idle. Press START to begin simulation."]);
  }, [initDrones]);

  // Simulation tick
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      tickRef.current++;
      const tick = tickRef.current;
      const d = dronesRef.current;
      const phase = phaseRef.current;

      // Phase 1: Drones spread out, explorer elected (tick 1-40)
      if (phase === 1) {
        d.forEach((drone, i) => {
          const targetX = 80 + i * (TUNNEL_WIDTH - 160) / (DRONE_COUNT - 1);
          drone.x += (targetX - drone.x) * 0.05;
          drone.depth = drone.x / TUNNEL_WIDTH * 100;
          drone.signalStrength = Math.max(0.1, 1 - drone.depth / 120);
        });
        if (tick === 20) {
          d[DRONE_COUNT - 1].role = "explorer";
          addLog("🟢 Drone #" + (DRONE_COUNT - 1) + " elected as EXPLORER (highest depth)");
        }
        if (tick === 30) {
          d[Math.floor(DRONE_COUNT / 2)].role = "relay";
          d[Math.floor(DRONE_COUNT / 2) + 1].role = "relay";
          addLog("🔵 Drones #" + Math.floor(DRONE_COUNT / 2) + ", #" + (Math.floor(DRONE_COUNT / 2) + 1) + " assigned as RELAYS");
        }
        if (tick >= 40) {
          phaseRef.current = 2;
          setSimPhase(2);
          addLog("📡 Relay chain established. Explorer advancing...");
        }
      }

      // Phase 2: Explorer moves deeper, relays adapt (tick 40-100)
      if (phase === 2) {
        const explorer = d.find((dr) => dr.role === "explorer");
        if (explorer) {
          explorer.x = Math.min(TUNNEL_WIDTH - 40, explorer.x + 1.2);
          explorer.depth = explorer.x / TUNNEL_WIDTH * 100;
          explorer.signalStrength = Math.max(0.05, 1 - explorer.depth / 100);
        }

        // Send data messages periodically
        if (tick % 8 === 0) {
          const chain = d.filter((dr) => dr.role === "relay" || dr.role === "explorer").sort((a, b) => b.x - a.x);
          for (let i = 0; i < chain.length - 1; i++) {
            messagesRef.current.push({
              id: msgIdRef.current++,
              fromX: chain[i].x,
              fromY: chain[i].y,
              toX: chain[i + 1].x,
              toY: chain[i + 1].y,
              progress: 0,
              type: "data",
            });
          }
        }

        if (tick === 70) {
          // Insert new relay
          const standby = d.find((dr) => dr.role === "standby" && dr.alive);
          if (standby) {
            standby.role = "relay";
            addLog("⚠ Signal degraded at 65m. Drone #" + standby.id + " promoted to RELAY");
          }
        }

        if (tick >= 100) {
          phaseRef.current = 3;
          setSimPhase(3);
          addLog("💀 Injecting relay failure...");
        }
      }

      // Phase 3: Relay failure + recovery (tick 100-150)
      if (phase === 3) {
        if (tick === 105) {
          const relays = d.filter((dr) => dr.role === "relay" && dr.alive);
          if (relays.length > 1) {
            relays[0].alive = false;
            relays[0].role = "standby";
            addLog("❌ Relay #" + relays[0].id + " FAILED — heartbeat lost");
          }
        }
        if (tick === 115) {
          const standby = d.find((dr) => dr.role === "standby" && dr.alive);
          if (standby) {
            standby.role = "relay";
            addLog("🔄 Chain repaired — Drone #" + standby.id + " took over relay position");
          }
        }
        if (tick % 8 === 0) {
          const chain = d.filter((dr) => (dr.role === "relay" || dr.role === "explorer") && dr.alive).sort((a, b) => b.x - a.x);
          for (let i = 0; i < chain.length - 1; i++) {
            messagesRef.current.push({
              id: msgIdRef.current++,
              fromX: chain[i].x,
              fromY: chain[i].y,
              toX: chain[i + 1].x,
              toY: chain[i + 1].y,
              progress: 0,
              type: tick >= 105 && tick < 115 ? "alert" : "data",
            });
          }
        }
        if (tick >= 150) {
          phaseRef.current = 4;
          setSimPhase(4);
          addLog("🎯 Victim detected at depth 92m!");
        }
      }

      // Phase 4: Victim found (tick 150+)
      if (phase === 4) {
        if (tick % 6 === 0) {
          const chain = d.filter((dr) => (dr.role === "relay" || dr.role === "explorer") && dr.alive).sort((a, b) => b.x - a.x);
          for (let i = 0; i < chain.length - 1; i++) {
            messagesRef.current.push({
              id: msgIdRef.current++,
              fromX: chain[i].x,
              fromY: chain[i].y,
              toX: chain[i + 1].x,
              toY: chain[i + 1].y,
              progress: 0,
              type: "data",
            });
          }
        }
        if (tick === 155) {
          addLog("✅ FOUND_VICTIM message relayed to base station!");
        }
        if (tick >= 180) {
          phaseRef.current = 5;
          setSimPhase(5);
          addLog("🏁 Simulation complete. All data relayed successfully.");
          setIsRunning(false);
        }
      }

      // Update message progress
      messagesRef.current = messagesRef.current
        .map((m) => ({ ...m, progress: m.progress + 0.06 }))
        .filter((m) => m.progress <= 1);

      dronesRef.current = [...d];
      setDrones([...d]);
      setMessages([...messagesRef.current]);
    }, 60);

    return () => clearInterval(interval);
  }, [isRunning, addLog]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = TUNNEL_WIDTH * dpr;
      canvas.height = TUNNEL_HEIGHT * dpr;
      ctx.scale(dpr, dpr);

      // Background
      const grad = ctx.createLinearGradient(0, 0, TUNNEL_WIDTH, 0);
      grad.addColorStop(0, "hsl(220, 18%, 12%)");
      grad.addColorStop(0.3, "hsl(220, 20%, 8%)");
      grad.addColorStop(0.7, "hsl(220, 25%, 5%)");
      grad.addColorStop(1, "hsl(220, 30%, 3%)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, TUNNEL_WIDTH, TUNNEL_HEIGHT);

      // Tunnel walls
      ctx.strokeStyle = "hsl(220, 15%, 20%)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(TUNNEL_WIDTH, 20);
      ctx.moveTo(0, TUNNEL_HEIGHT - 20);
      ctx.lineTo(TUNNEL_WIDTH, TUNNEL_HEIGHT - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Depth markers
      ctx.fillStyle = "hsl(215, 15%, 30%)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      for (let i = 0; i <= 100; i += 20) {
        const x = (i / 100) * TUNNEL_WIDTH;
        ctx.fillText(i + "m", x + 2, 16);
        ctx.strokeStyle = "hsl(220, 15%, 15%)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, TUNNEL_HEIGHT - 20);
        ctx.stroke();
      }

      // Signal degradation overlay
      const sigGrad = ctx.createLinearGradient(0, 0, TUNNEL_WIDTH, 0);
      sigGrad.addColorStop(0, "hsla(185, 80%, 50%, 0.03)");
      sigGrad.addColorStop(0.5, "hsla(35, 95%, 55%, 0.02)");
      sigGrad.addColorStop(1, "hsla(0, 70%, 50%, 0.04)");
      ctx.fillStyle = sigGrad;
      ctx.fillRect(0, 0, TUNNEL_WIDTH, TUNNEL_HEIGHT);

      // Draw relay chain connections
      const chain = drones
        .filter((d) => (d.role === "relay" || d.role === "explorer") && d.alive)
        .sort((a, b) => a.x - b.x);
      if (chain.length > 1) {
        ctx.strokeStyle = "hsl(185, 80%, 50%)";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i < chain.length; i++) {
          if (i === 0) ctx.moveTo(chain[i].x, chain[i].y);
          else ctx.lineTo(chain[i].x, chain[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Draw messages
      messages.forEach((m) => {
        const x = m.fromX + (m.toX - m.fromX) * m.progress;
        const y = m.fromY + (m.toY - m.fromY) * m.progress;
        const color =
          m.type === "alert"
            ? "hsl(35, 95%, 55%)"
            : m.type === "heartbeat"
            ? "hsl(145, 70%, 45%)"
            : "hsl(185, 80%, 60%)";
        ctx.fillStyle = color;
        ctx.globalAlpha = 1 - m.progress * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Draw drones
      drones.forEach((d) => {
        if (!d.alive) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = "hsl(0, 70%, 50%)";
          ctx.beginPath();
          ctx.moveTo(d.x - 6, d.y - 6);
          ctx.lineTo(d.x + 6, d.y + 6);
          ctx.moveTo(d.x + 6, d.y - 6);
          ctx.lineTo(d.x - 6, d.y + 6);
          ctx.strokeStyle = "hsl(0, 70%, 50%)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
          return;
        }

        const color = roleColors[d.role];

        // Signal rings for explorer
        if (d.role === "explorer") {
          ctx.globalAlpha = 0.1;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          for (let r = 1; r <= 3; r++) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, 10 + r * 8, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Drone body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.role === "explorer" ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.role === "explorer" ? 14 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Label
        ctx.fillStyle = "hsl(200, 20%, 70%)";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText("#" + d.id, d.x - 5, d.y - 12);
      });

      // Entrance label
      ctx.fillStyle = "hsl(145, 70%, 45%)";
      ctx.font = "bold 11px 'Space Grotesk', sans-serif";
      ctx.fillText("BASE", 10, TUNNEL_HEIGHT - 6);

      // Deep end label
      ctx.fillStyle = "hsl(0, 70%, 50%)";
      ctx.fillText("BLACKOUT ZONE", TUNNEL_WIDTH - 110, TUNNEL_HEIGHT - 6);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [drones, messages]);

  const phaseLabels = [
    "IDLE",
    "DEPLOYING",
    "EXPLORING",
    "FAILURE RECOVERY",
    "VICTIM FOUND",
    "COMPLETE",
  ];

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={isRunning ? resetSimulation : startSimulation}
            className={`px-4 py-2 rounded-lg font-mono text-sm font-semibold transition-all ${
              isRunning
                ? "bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30"
                : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 glow-cyan"
            }`}
          >
            {isRunning ? "■ RESET" : "▶ START"}
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            Phase: <span className="text-primary">{phaseLabels[simPhase]}</span>
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Explorer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary/70" /> Relay
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /> Standby
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl border border-glow overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ width: TUNNEL_WIDTH, height: TUNNEL_HEIGHT }}
          className="w-full"
        />
      </div>

      {/* Drone Status Bar */}
      <div className="grid grid-cols-6 gap-2">
        {drones.map((d) => (
          <div
            key={d.id}
            className={`rounded-lg border p-2 text-center font-mono text-xs transition-all ${
              !d.alive
                ? "border-destructive/30 bg-destructive/5 opacity-50"
                : d.role === "explorer"
                ? "border-primary/40 bg-primary/10"
                : d.role === "relay"
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className={`font-semibold ${!d.alive ? "text-destructive" : roleLabelColors[d.role]}`}>
              #{d.id}
            </div>
            <div className="text-muted-foreground mt-0.5">
              {!d.alive ? "DEAD" : d.role.toUpperCase()}
            </div>
            <div className="text-muted-foreground/60 mt-0.5">
              {Math.round(d.depth)}m
            </div>
          </div>
        ))}
      </div>

      {/* Log */}
      <div className="rounded-xl border border-border bg-card/50 p-3 max-h-40 overflow-y-auto">
        <div className="font-mono text-xs space-y-1">
          {statusLog.map((log, i) => (
            <motion.div
              key={log + i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1 - i * 0.1, x: 0 }}
              className="text-muted-foreground"
            >
              {log}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
