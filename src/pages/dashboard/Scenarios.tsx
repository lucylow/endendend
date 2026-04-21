import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Link2,
  UserX,
  Plane,
  ArrowRight,
  LifeBuoy,
  Trophy,
  Flame,
  Orbit,
  Thermometer,
  Magnet,
  BrickWall,
  GitMerge,
  Shield,
  Shuffle,
  Vote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SAR_SCENARIOS } from "@/lib/scenarios/registry";

const scenarios: {
  title: string;
  body: string;
  icon: typeof Link2;
  bullets?: string[];
  demoLink?: string;
}[] = [
  {
    title: "The Dynamic Daisy Chain (Scenario 1)",
    body:
      "Collapsed tunnel (~200 m): RF to the entrance fades with depth (~50% loss near 100 m, ~80% near 150 m). Five drones start at the entrance; they discover peers, elect a lead explorer, and when the explorer reaches ~30 m effective depth the swarm promotes the best standby near ~15 m as the first relay (midpoint placement). That relay stops and forwards heartbeats and explorer state upward; additional relays insert toward the midpoint of the last hop as loss rises. No cloud — only Vertex-style P2P. Full baseline steps (5.1), architecture, and Python timeline: Search & Rescue demo → Dynamic Relay Chain → “Example scenario 1 — full script”, plus swarm/scenario_dynamic_daisy_chain.py and swarm/scenarios/scenario1_baseline_daisy_chain.json.",
    icon: Link2,
  },
  {
    title: 'The "Fallen Comrade" (Role Reallocation)',
    body:
      "Track 2 — distributed search grid: five rovers each own a rectangular sector (e.g. vertical strips on a 100×100 cell map). They explore only inside their bounds, mark cells searched, and share state via FoxMQ-style gossip — no cloud planner. When Rover B stops (battery, trap, fault), heartbeats vanish; ChainManager evicts the peer and SectorManager must treat B’s strip as orphaned. Survivors use random backoff so one proposer usually wins, broadcasts REALLOCATION_PROPOSAL with a fair geometric split (equal area along the long axis), collect VOTE_ACCEPT / VOTE_REJECT, then apply SECTOR_UPDATE and persist sector_assignments. ExplorationManager keeps next targets inside the updated sector; the global explored map prevents duplicate visits to cells B already cleared. Optional BFT is overkill for the happy path — simple majority among honest peers is enough. Webots: open-field world + sector overlay; Python touchpoints: chain_manager (timeout → handle_peer_death), exploration (sector filter), future sector_manager.py, robot_proto open_field.",
    bullets: [
      "Failure detection: short heartbeat timeout (≈3–5s demo) → instant reallocation trigger.",
      "Messages: REALLOCATION_PROPOSAL, VOTE_ACCEPT / VOTE_REJECT, SECTOR_UPDATE.",
      "Edge cases: false positives (flaky link), proposer crash (retry), multiple deaths (idempotent rounds).",
    ],
    demoLink: "/scenarios/search-rescue/fallen-comrade",
    icon: UserX,
  },
  {
    title: "The Blind Handoff (Air-to-Ground)",
    body:
      "A fast-moving aerial drone conducts a coarse sweep and detects a victim (mocked or GPS proximity). With battery below the handoff threshold, it broadcasts RESCUE_HANDOFF_REQUEST over Vertex (no cloud). Ground rovers reply with HANDOFF_BID (distance / ETA); the aerial picks the lowest bid, sends HANDOFF_ACCEPT, receives HANDOFF_ACK, and the chosen rover navigates to the victim and broadcasts RESCUE_COMPLETE. Python: DroneController + NetworkEmulator.unicast / VertexNode.send; test: swarm/tests/test_blind_handoff.py.",
    bullets: [
      "Messages: RESCUE_HANDOFF_REQUEST, HANDOFF_BID, HANDOFF_ACCEPT, HANDOFF_ACK, RESCUE_COMPLETE.",
      "Dashboard: Search & Rescue → scenario “Blind Handoff (Air-to-Ground)” — aerial vs ground meshes, victim marker, handoff log.",
    ],
    demoLink: "/scenarios/search-rescue/blind-handoff",
    icon: Plane,
  },
  {
    title: "Multi-Swarm Handoff (Scenario 9)",
    body:
      "Two independent fleets: Swarm A explores and finds a heavy-lift target; a FoxMQ-style broadcast carries coordinates and stakes; Swarm B adopts an approach vector and lift ring with an 18ms-class consensus narrative and zero-downtime metrics.",
    bullets: [
      "Route: /scenarios/multi-swarm-handoff — also embedded in Search & Rescue → Multi-Swarm Handoff.",
      "Controls: Reset demo, force handoff, live dual-fleet 3D + sidebar timeline.",
    ],
    demoLink: "/scenarios/multi-swarm-handoff",
    icon: GitMerge,
  },
  {
    title: "Arena Obstacle Course (Scenario 10)",
    body:
      "Ten agents in a procedural warehouse: pallets, shelving, start and gold finish zones. Emergent navigation mixes goal seeking, obstacle repulsion, separation, and lane bias — compared to a coarse grid A* baseline with replan penalty on the metrics rail. Built for screen recording: reset, reseed, difficulty, and race controls.",
    bullets: [
      "Route: /scenarios/arena-obstacle — also opens from SAR when you pick “Arena Obstacle Course”.",
      "Judging: start race → first agent across x = 42; panel shows swarm time vs baseline and % faster.",
    ],
    demoLink: "/scenarios/arena-obstacle",
    icon: Trophy,
  },
  {
    title: "Stake-weighted voting (Scenario 11)",
    body:
      "3D fork: risky vs optimal path. Even head-count preferences with uneven stake; live weighted tally and swarm motion toward the economic winner. Side rail contrasts ~92% optimal (weighted) vs ~51% democracy baseline; equalize stakes to show the flip.",
    bullets: [
      "Route: /scenarios/stake-voting — embedded in SAR → Stake-Weighted Voting.",
      "Controls: pause, boost optimal stake, equal stakes, reset.",
    ],
    demoLink: "/scenarios/stake-voting",
    icon: Vote,
  },
  {
    title: "Predator evasion / forklift (Scenario 12)",
    body:
      "Warehouse forklift crosses the formation; scatter then reform with separation metrics, mission delay vs ~8s static baseline, and manual force/clear threat for judges.",
    bullets: [
      "Route: /scenarios/predator-evasion — embedded in SAR → Predator Evasion.",
      "Controls: sim speed, force threat, clear (suppress auto), reset.",
    ],
    demoLink: "/scenarios/predator-evasion",
    icon: Shield,
  },
  {
    title: "Battery Cascade Failure Recovery",
    body:
      "Tunnel relay chain with role-based drain, simulated sub-50ms heartbeat windows, forced cascade at ~45s, and standby→relay auto-promotion. Side rail proves +42% mission duration vs centralized abort baseline.",
    bullets: [
      "Routes: /scenarios/battery-cascade (full screen) or Search & Rescue → Battery Cascade Failure Recovery.",
      "Controls: accelerate failure, time scale, pause, reset — 3D meters + promotion log.",
    ],
    demoLink: "/scenarios/battery-cascade",
    icon: Flame,
  },
  {
    title: "Circular Obstacle Bypass",
    body:
      "Warehouse pillar with FoxMQ-style obstacle repulsion, stake-weighted CCW consensus, and boids layering. Toggle leader–follower to stress hull contacts vs emergent circulation; metrics compare rolling clearance to a 37% design baseline.",
    bullets: [
      "Routes: /scenarios/obstacle-bypass or /scenarios/circular-bypass — SAR embed: Circular Obstacle Bypass.",
    ],
    demoLink: "/scenarios/obstacle-bypass",
    icon: Orbit,
  },
  {
    title: "Cooling formation swarm (thermal rebalance)",
    body:
      "Forklift exhaust as a central heat plume: inverse-square heating, airflow cooling, and an 80°C emergency where agents apply consensus separation plus cooler-agent shielding. Four rovers with live gauges; recovery timer tracks elapsed time since the first emergency against a 92s SLA-style target.",
    bullets: [
      "Route: /scenarios/thermal-rebalance — dashboard sidebar under Missions.",
      "Modules: HeatPropagationModel, ThermalVotingEngine, CoolingFormationSwarm.",
    ],
    demoLink: "/scenarios/thermal-rebalance",
    icon: Thermometer,
  },
  {
    title: "Magnetic victim attraction",
    body:
      "Six beacons with adjustable stake weights. Vertex-style weighting builds a synthetic attraction field; agents and pull lines converge on the dominant value. Side rail compares field score to a 42% random baseline and lists ranked victims.",
    bullets: ["Route: /scenarios/magnetic-attraction.", "Sliders retune priorities live without reload."],
    demoLink: "/scenarios/magnetic-attraction",
    icon: Magnet,
  },
  {
    title: "Collapsing tunnel re-formation",
    body:
      "Trigger a rear collapse that buries three tail units. Survivors chain toward the exit; crossing the uplink gate fires the beacon pulse. Metrics compare mesh rescue duration to a manual planner baseline and show the speedup factor.",
    bullets: ["Route: /scenarios/collapsing-tunnel.", "Disaster controls: trigger, pause, reset."],
    demoLink: "/scenarios/collapsing-tunnel",
    icon: BrickWall,
  },
  {
    title: "Evasion maneuver engine (scatter → reform)",
    body:
      "Warehouse floor with a red forklift threat: orthogonal scatter then reform behind the threat. Side rail compares ~8s mission delay vs a static-formation baseline and tracks live threat distance and collision risk.",
    bullets: [
      "Route: /scenarios/predator-evasion.",
      "Engine: EvasionManeuverEngine — scatter / reform phases driven from sim clock.",
    ],
    demoLink: "/scenarios/predator-evasion",
    icon: Shield,
  },
  {
    title: "Random leader failure (self-healing)",
    body:
      "Random agent kill every ~30s with automatic role rebalance (leader → relay → standby by stake). Metrics show synthetic uptime vs loss rate and a sampled continuity strip chart — enterprise resilience narrative.",
    bullets: ["Route: /scenarios/random-failure.", "Controls: time scale, pause, reset."],
    demoLink: "/scenarios/random-failure",
    icon: Shuffle,
  },
];

export default function ScenariosPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          <span className="text-primary font-mono">!</span> Example scenarios
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Concrete stories you can demo against the Vertex mesh, live simulation, and agent roster — relay formation, heartbeat failure, and disconnected handoffs.
        </p>
        <Button asChild className="mt-2 gap-2 bg-violet-600 hover:bg-violet-500">
          <Link to="/scenarios/search-rescue">
            <LifeBuoy className="h-4 w-4" />
            Open Search &amp; Rescue master demo (16 scenarios)
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">
          Example Scenarios to Get You Started:
        </h2>
        <div className="grid gap-5 md:grid-cols-1 lg:grid-cols-3">
          {scenarios.map(({ title, body, bullets, demoLink, icon: Icon }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="h-full bg-card/50 border-border card-hover flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary mb-3">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground leading-snug">{title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  {bullets && bullets.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4 leading-relaxed">
                      {bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {demoLink && (
                    <Button asChild variant="outline" size="sm" className="mt-auto w-fit gap-1.5 border-primary/25">
                      <Link to={demoLink}>
                        Open full demo script
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-base font-semibold text-foreground">Other leaderless scenarios</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fifteen Vertex + FoxMQ presets in the SAR master demo — emergent coordination, role negotiation, and consensus
            without a cloud planner. Open any row for the live 3D canvas, chaos slider, and judge-ready brief.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SAR_SCENARIOS.map((s, i) => (
            <motion.div
              key={s.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.02, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={`/scenarios/search-rescue/${s.slug}`}
                className="flex items-start gap-3 rounded-xl border border-border/80 bg-card/40 p-3 transition-colors hover:border-primary/35 hover:bg-card/60"
              >
                <span className="text-xl shrink-0" aria-hidden>
                  {s.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <span className="text-sm font-medium text-foreground leading-snug">{s.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      P{s.phase}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{s.tagline}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
