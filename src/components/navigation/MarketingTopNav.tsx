import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function MarketingTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-sm font-bold tracking-tight text-zinc-100">
          Tashi <span className="text-emerald-400">Swarm</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-zinc-400">
          <Link to="/features" className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-zinc-100">
            Features
          </Link>
          <Link to="/demo" className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-zinc-100">
            Demo
          </Link>
          <Link to="/docs" className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-zinc-100">
            Docs
          </Link>
        </nav>
        <Button asChild size="sm" className="glow-cyan font-semibold">
          <Link to="/swarm">Launch Live Demo</Link>
        </Button>
      </div>
    </header>
  );
}
