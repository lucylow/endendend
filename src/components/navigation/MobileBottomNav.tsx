import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bug, History, Radio, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/swarm", label: "Live", icon: Radio, match: (p: string) => p === "/swarm" || p.startsWith("/swarm/") },
  { to: "/drone/drone-0", label: "Drone", icon: Bug, match: (p: string) => p.startsWith("/drone") },
  { to: "/metrics", label: "Metrics", icon: BarChart3, match: (p: string) => p === "/metrics" || p.startsWith("/metrics/") },
  { to: "/replay", label: "Replay", icon: History, match: (p: string) => p === "/replay" || p.startsWith("/replay/") },
  { to: "/settings", label: "Setup", icon: Settings, match: (p: string) => p === "/settings" || p.startsWith("/settings/") },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary mission navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[var(--glass-bg)] px-2 pb-3 pt-2 backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium text-zinc-400 transition",
                  active && "text-emerald-400",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
