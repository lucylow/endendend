import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { motion } from "framer-motion";
import MissionStatusStrip from "@/components/MissionStatusStrip";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Gavel,
  Landmark,
  Film,
  Users,
  DollarSign,
  CreditCard,
  Clapperboard,
  Trophy,
  BookOpen,
  ShieldCheck,
  Hexagon,
  Box,
  LifeBuoy,
  ScanEye,
  Menu,
  GitMerge,
  Thermometer,
  Magnet,
  BrickWall,
  Shield,
  Shuffle,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Command",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/dashboard/simulation", label: "Live simulation", icon: Landmark },
      { to: "/dashboard/swarm", label: "3D swarm viz", icon: Box },
      { to: "/dashboard/victim-detection", label: "Victim detection", icon: ScanEye },
      { to: "/dashboard/scalability", label: "Scalability", icon: Activity },
      { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Economy",
    items: [
      { to: "/dashboard/auctions", label: "Task auctions", icon: Gavel },
      { to: "/dashboard/staking", label: "Staking & Rewards", icon: DollarSign },
      { to: "/dashboard/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Missions",
    items: [
      { to: "/dashboard/replay", label: "Mission replay", icon: Film },
      { to: "/dashboard/scenarios", label: "Scenarios", icon: Clapperboard },
      { to: "/scenarios/search-rescue", label: "SAR master demo", icon: LifeBuoy },
      { to: "/scenarios/arena-obstacle", label: "Arena obstacle course", icon: Trophy },
      { to: "/scenarios/multi-swarm-handoff", label: "Multi-swarm handover", icon: GitMerge },
      { to: "/scenarios/thermal-rebalance", label: "Thermal rebalance", icon: Thermometer },
      { to: "/scenarios/magnetic-attraction", label: "Magnetic attraction", icon: Magnet },
      { to: "/scenarios/collapsing-tunnel", label: "Collapsing tunnel", icon: BrickWall },
      { to: "/scenarios/predator-evasion", label: "Predator / forklift evasion", icon: Shield },
      { to: "/scenarios/random-failure", label: "Random leader failure", icon: Shuffle },
    ],
  },
  {
    label: "Fleet",
    items: [
      { to: "/dashboard/agents", label: "Agents", icon: Users },
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

const linkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const linkActive = "bg-primary/10 text-primary font-medium border border-primary/25 shadow-sm shadow-primary/5";

function SidebarBrand() {
  return (
    <div className="border-b border-border/70 p-5">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-teal-500/15 to-violet-500/15 group-hover:border-teal-500/30 transition-colors">
          <Hexagon className="h-5 w-5 text-teal-400" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-foreground tracking-tight">Tashi Swarm</h2>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Control Center</p>
        </div>
      </Link>
      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
        Production swarm <span className="font-mono text-foreground/80">#ALPHA-01</span> — Vertex mesh + FoxMQ telemetry.
      </p>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3" aria-label="Dashboard">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/90">{group.label}</p>
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={cn(linkBase)}
                activeClassName={linkActive}
                onClick={onNavigate}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border/70 p-3 space-y-0.5">
        <NavLink to="/docs" className={linkBase} activeClassName={linkActive} onClick={onNavigate}>
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          Documentation
        </NavLink>
        <NavLink to="/admin" className={linkBase} activeClassName={linkActive} onClick={onNavigate}>
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          Admin
        </NavLink>
      </div>
    </>
  );
}

const asideClass =
  "flex w-[17.5rem] shrink-0 flex-col border-r border-border bg-card/25 backdrop-blur-md";

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>

      <motion.aside
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(asideClass, "hidden lg:flex")}
      >
        <SidebarBrand />
        <SidebarNav />
      </motion.aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-teal-500/15 to-violet-500/15">
                <Hexagon className="h-4 w-4 text-teal-400" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-foreground">Tashi Swarm</span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Control Center
                </span>
              </div>
            </Link>
          </header>
          <SheetContent side="left" className="w-[min(100%,18rem)] gap-0 border-border p-0">
            <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
            <div className="flex h-full min-h-0 flex-col pt-12">
              <SidebarBrand />
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="sticky top-0 z-20 hidden lg:block border-b border-border bg-background/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2">
          <MissionStatusStrip />
        </div>

        <main
          id="dashboard-main"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
