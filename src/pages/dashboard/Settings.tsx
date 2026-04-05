import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const settings = [
  { id: "notifications", label: "Push Notifications", desc: "Receive alerts for critical swarm events", default: true },
  { id: "autoRelay", label: "Auto Relay Insertion", desc: "Automatically insert relay nodes when signal degrades", default: true },
  { id: "darkMode", label: "Dark Mode", desc: "Use dark theme throughout the application", default: true },
  { id: "telemetry", label: "Share Telemetry", desc: "Send anonymous usage data to improve the platform", default: false },
  { id: "sounds", label: "Alert Sounds", desc: "Play audio alerts for critical events", default: false },
  { id: "autoStake", label: "Auto-Compound Rewards", desc: "Automatically restake earned rewards", default: true },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Toggle the behaviors judges ask about most: relay automation, telemetry sharing, and alert audio. Switches are
          local to this demo shell — wire them to your operator ACL service when you harden for production.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">GENERAL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor={s.id} className="text-sm font-medium text-foreground">{s.label}</Label>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <Switch id={s.id} defaultChecked={s.default} />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground">DANGER ZONE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="destructive" size="sm">Reset All Settings</Button>
            <Button variant="outline" size="sm" className="ml-3">Export Configuration</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
