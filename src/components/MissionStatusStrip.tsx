import { Activity, Radio, Users, Zap, AlertTriangle, Wallet } from "lucide-react";
import { useSwarmStore } from "@/store/swarmStore";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";

function Dot({ status }: { status: "ok" | "warn" | "critical" }) {
  const color =
    status === "ok"
      ? "bg-success"
      : status === "warn"
        ? "bg-accent"
        : "bg-destructive";
  return (
    <span className="relative flex h-2 w-2">
      {status !== "ok" && (
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-50", color)} />
      )}
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </span>
  );
}

export default function MissionStatusStrip() {
  const { isConnected, account, openModal } = useWallet();
  const agents = useSwarmStore((s) => s.agents);
  const isRunning = useSwarmStore((s) => s.isRunning);
  const behaviorMode = useSwarmStore((s) => s.behaviorMode);
  const missions = useSwarmStore((s) => s.missions);
  const faultConfig = useSwarmStore((s) => s.faultConfig);
  const explorationProgress = useSwarmStore((s) => s.explorationProgress);

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalAgents = agents.length;
  const avgBattery = agents.length
    ? Math.round(agents.reduce((s, a) => s + a.battery, 0) / agents.length)
    : 0;
  const criticalAgents = agents.filter((a) => a.battery < 20 || a.status !== "active").length;

  const healthStatus: "ok" | "warn" | "critical" =
    criticalAgents > 2 ? "critical" : criticalAgents > 0 ? "warn" : "ok";

  const currentMission = missions[0];
  const modeLabel =
    behaviorMode === "idle"
      ? "Idle"
      : behaviorMode === "exploring"
        ? "Exploring"
        : behaviorMode === "rescue"
          ? "Rescue"
          : "Combined ops";

  return (
    <div className="flex items-center gap-3 overflow-x-auto rounded-xl border border-border/60 bg-card/40 backdrop-blur-md px-3 py-2 text-[11px] sm:text-xs">
      {/* Swarm health */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Dot status={healthStatus} />
        <Activity className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-muted-foreground">Fleet</span>
        <span
          className={cn(
            "font-mono font-semibold",
            healthStatus === "ok"
              ? "text-success"
              : healthStatus === "warn"
                ? "text-accent"
                : "text-destructive"
          )}
        >
          {healthStatus === "ok" ? "Healthy" : healthStatus === "warn" ? "Warning" : "Critical"}
        </span>
      </div>

      <span className="text-border">|</span>

      {/* Active agents */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Users className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-muted-foreground">Agents</span>
        <span className="font-mono font-semibold text-foreground">
          {activeAgents}/{totalAgents}
        </span>
      </div>

      <span className="text-border">|</span>

      {/* Avg battery */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Zap className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-muted-foreground">Avg battery</span>
        <span
          className={cn(
            "font-mono font-semibold",
            avgBattery > 50 ? "text-success" : avgBattery > 25 ? "text-accent" : "text-destructive"
          )}
        >
          {avgBattery}%
        </span>
      </div>

      <span className="text-border hidden sm:inline">|</span>

      {/* Mode / scenario */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <Radio className="h-3.5 w-3.5 text-primary/70" />
        <span className="text-muted-foreground">Mode</span>
        <span className="font-mono font-semibold text-foreground">{modeLabel}</span>
        {isRunning && (
          <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-mono text-success ring-1 ring-success/30">
            LIVE
          </span>
        )}
      </div>

      {/* Packet loss warning */}
      {faultConfig.packetLoss > 15 && (
        <>
          <span className="text-border hidden md:inline">|</span>
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-accent">{faultConfig.packetLoss}% loss</span>
          </div>
        </>
      )}

      {/* Exploration */}
      {explorationProgress > 0 && (
        <>
          <span className="text-border hidden lg:inline">|</span>
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <span className="text-muted-foreground">Explored</span>
            <span className="font-mono font-semibold text-foreground">{explorationProgress.toFixed(0)}%</span>
          </div>
        </>
      )}

      {isConnected && account ? (
        <>
          <span className="text-border hidden xl:inline">|</span>
          <div className="hidden xl:flex items-center gap-1.5 shrink-0">
            <Wallet className="h-3.5 w-3.5 text-primary/70" aria-hidden />
            <span className="text-muted-foreground">Operator</span>
            <button
              type="button"
              className={cn(
                "max-w-[10rem] truncate rounded-md border border-transparent px-1 py-0.5 font-mono text-[10px] font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                account.isMock ? "text-amber-200" : "text-emerald-200",
              )}
              onClick={openModal}
              title={account.address}
            >
              <span className="sr-only">Wallet connected: </span>
              {account.isMock ? "Demo " : "Live "}
              {account.address.slice(0, 6)}…{account.address.slice(-4)}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
