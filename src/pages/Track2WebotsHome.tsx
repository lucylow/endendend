import { Link } from "@tanstack/react-router";

export default function Track2WebotsHome() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-background to-zinc-900 text-foreground">
      <div className="px-6 text-center">
        <h1 className="mb-6 text-5xl font-black tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-sky-400 to-violet-500 bg-clip-text text-transparent">
            endendend Swarm Sims
          </span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Track 2: Fallen Comrade, Blind Handoff, Daisy Chain — Webots JSON stream → Vite + React Three Fiber @ 60fps.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/scenarios/fallen"
            className="rounded-xl bg-sky-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-sky-500"
          >
            Fallen Comrade
          </Link>
          <Link
            to="/scenarios/handoff"
            className="rounded-xl bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-violet-500"
          >
            Blind Handoff
          </Link>
          <Link
            to="/scenarios/daisy"
            className="rounded-xl bg-emerald-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-500"
          >
            Daisy Chain
          </Link>
        </div>
        <p className="mt-10 font-mono text-xs text-muted-foreground">
          Webots: <code className="rounded bg-muted px-1 py-0.5">webots worlds/fallen_comrade.wbt</code> — stream ws://127.0.0.1:8765
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          UI dev server defaults to port 8080 (see <code className="rounded bg-muted px-1">vite.config.ts</code>).
        </p>
      </div>
    </div>
  );
}
