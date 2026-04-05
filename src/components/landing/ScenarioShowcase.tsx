import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Route, Unplug, HeartPulse, RefreshCw, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1] as const;

const scenarios = [
  {
    icon: Route,
    title: "Dynamic Relay Chain",
    desc: "Drones self-organize into a communication chain that adapts as signal degrades deeper into the tunnel.",
    to: "/scenarios/search-rescue",
    accentColor: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/10 border-primary/20",
  },
  {
    icon: Unplug,
    title: "Collapsing Tunnel",
    desc: "Simulate structural collapse — watch the swarm detect heartbeat loss and reform the relay chain in under two seconds.",
    to: "/scenarios/collapsing-tunnel",
    accentColor: "from-accent/20 to-accent/5",
    iconBg: "bg-accent/10 border-accent/20",
  },
  {
    icon: HeartPulse,
    title: "Battery Cascade",
    desc: "Agents deplete batteries at different rates. The swarm promotes standby nodes and rotates roles to sustain the mission.",
    to: "/scenarios/battery-cascade",
    accentColor: "from-primary/15 to-primary/5",
    iconBg: "bg-primary/10 border-primary/15",
  },
  {
    icon: RefreshCw,
    title: "Random Failure",
    desc: "Inject faults at random intervals. Observe self-healing consensus and automatic relay insertion without central control.",
    to: "/scenarios/random-failure",
    accentColor: "from-destructive/12 to-destructive/5",
    iconBg: "bg-destructive/10 border-destructive/15",
  },
  {
    icon: Target,
    title: "Magnetic Attraction",
    desc: "Agents converge on victim heat signatures using decentralized priority scoring and stake-weighted triage.",
    to: "/scenarios/magnetic-attraction",
    accentColor: "from-accent/15 to-accent/5",
    iconBg: "bg-accent/10 border-accent/15",
  },
  {
    icon: Zap,
    title: "Stake Voting",
    desc: "Agents vote on path selection using BFT consensus weighted by stake — the swarm decides collectively which fork to take.",
    to: "/scenarios/stake-voting",
    accentColor: "from-primary/18 to-primary/5",
    iconBg: "bg-primary/10 border-primary/20",
  },
];

export default function ScenarioShowcase() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-6 scroll-mt-24" id="scenarios">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="mb-12"
        >
          <span className="font-mono text-xs text-primary/80 tracking-[0.22em] uppercase inline-flex items-center gap-2">
            <span className="w-8 h-px bg-primary/40" />
            Mission scenarios
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3 tracking-tight">
            Six ways the swarm proves itself
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Each scenario isolates a specific operational behavior — relay formation, failure recovery, consensus voting,
            and more. Run them live in your browser.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {scenarios.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5, ease }}
            >
              <Link
                to={s.to}
                className="group relative block rounded-2xl border border-border/40 bg-card/20 backdrop-blur-md p-5 sm:p-6 card-hover h-full overflow-hidden"
              >
                {/* Subtle gradient accent on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${s.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${s.iconBg} border mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className="w-4.5 h-4.5 text-foreground/80" />
                  </div>
                  <h3 className="font-semibold text-foreground text-base mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary/60 mt-4 group-hover:text-primary transition-colors duration-300 font-medium">
                    Run scenario
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <Link to="/dashboard/scenarios">
            <Button variant="outline" size="sm" className="rounded-full border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all duration-300">
              View all scenarios
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
