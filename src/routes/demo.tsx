import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black/50 shadow-2xl">
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-900 to-black text-zinc-500">
          Full-screen hero video placeholder
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {["Chain", "Victims", "Blackout", "Consensus", "Replay", "Metrics"].map((label) => (
          <div
            key={label}
            className="flex aspect-[4/3] items-center justify-center rounded-xl border border-white/10 bg-[var(--glass-bg)] text-xs font-medium text-zinc-300 backdrop-blur-md"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <Button asChild variant="outline" className="border-white/15">
          <Link to="/">Home</Link>
        </Button>
        <Button asChild>
          <Link to="/swarm">Run swarm</Link>
        </Button>
      </div>
    </div>
  );
}
