import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const cards = [
  { title: "Vertex BFT", body: "Byzantine fault tolerant ordering for mesh telemetry." },
  { title: "FoxMQ", body: "Durable edge messaging with reconciliation when links flap." },
  { title: "ROS2 Swarm", body: "Bridge-friendly topics for Webots + real robots." },
  { title: "Safety layer", body: "Geofence, thermal, and battery tripwires with E-STOP." },
  { title: "P2P consensus", body: "Zero-cloud operator mode with signed peer events." },
  { title: "Replay & metrics", body: "Post-mission forensics with scrubbed timelines." },
];

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white md:text-4xl">Deep dive</h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-400">
        Everything judges tap in Track 2 — consensus, messaging, swarm stack, and safety.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="card-lift h-full border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg text-white">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-400">{c.body}</CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="mt-12 flex justify-center">
        <Button asChild className="glow-cyan">
          <Link to="/swarm">Open live swarm</Link>
        </Button>
      </div>
    </div>
  );
}
