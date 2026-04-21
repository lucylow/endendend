import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bug,
  Globe2,
  History,
  LayoutDashboard,
  Radio,
  Scale,
  ScrollText,
  Settings,
  Share2,
  ShieldAlert,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const fleet = ["drone-0", "drone-1", "drone-2", "drone-3", "drone-4"] as const;

const nav = [
  { to: "/swarm", label: "Live Swarm", icon: Radio },
  { to: "/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/replay", label: "Replay", icon: History },
  { to: "/tasks", label: "Task Auctions", icon: ShoppingCart },
  { to: "/vertex", label: "Vertex P2P", icon: Share2 },
  { to: "/network", label: "Network Emulation", icon: Activity },
  { to: "/safety", label: "Safety", icon: ShieldAlert },
  { to: "/logs", label: "Mission Logs", icon: ScrollText },
  { to: "/drones", label: "Fleet", icon: LayoutDashboard },
  { to: "/worlds", label: "Simulation", icon: Globe2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function matchPath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl md:flex">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-4">
        <Scale className="h-8 w-8 text-emerald-400" aria-hidden />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Tashi</p>
          <p className="text-sm font-bold text-zinc-100">Swarm Control</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Operations</p>
        {nav.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white",
              matchPath(pathname, to) && "bg-emerald-500/15 text-emerald-300",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {label}
          </Link>
        ))}

        <p className="mt-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Drones</p>
        {fleet.map((id) => (
          <Link
            key={id}
            to="/drone/$id"
            params={{ id }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 pl-5 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100",
              matchPath(pathname, `/drone/${id}`) && "bg-cyan-500/10 text-cyan-200",
            )}
          >
            <Bug className="h-3.5 w-3.5" aria-hidden />
            {id}
          </Link>
        ))}

        <p className="mt-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Review &amp; Admin</p>
        {nav.slice(4).map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white",
              matchPath(pathname, to) && "bg-emerald-500/15 text-emerald-300",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {label}
          </Link>
        ))}
      </div>

      <div className="border-t border-white/5 p-3">
        <Button
          type="button"
          variant="destructive"
          className="w-full font-bold"
          aria-label="Emergency stop all drones"
          onClick={() => toast.error("E-STOP (demo) — all agents halted")}
        >
          E-STOP
        </Button>
        <Link
          to="/docs"
          className="mt-2 block rounded-md px-2 py-1.5 text-center text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Legacy docs
        </Link>
      </div>
    </aside>
  );
}
