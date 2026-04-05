import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSwarmStore } from "@/store/swarmStore";
import { Play, Pause, SkipBack, SkipForward, Clock } from "lucide-react";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";

export default function ReplayPage() {
  const { missions } = useSwarmStore();
  const mission = missions[0];
  const [currentTime, setCurrentTime] = useState([50]);
  const [playing, setPlaying] = useState(false);

  if (!mission) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mission replay</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Scrub through signed mission timelines, correlate agent failures with relay insertions, and export clips for
            judges. Load a mission from the store to populate this view.
          </p>
        </div>
        <Card className="bg-card/50 border-border border-dashed">
          <CardContent className="p-10 text-center space-y-2">
            <p className="text-foreground font-medium">No replay payload yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When mission archives sync from the mesh, they appear here with a draggable timeline and event-accurate
              markers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalEvents = mission.events.length;
  const visibleEvents = mission.events.filter(
    (_, i) => (i / totalEvents) * 100 <= currentTime[0]
  );

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Mission replay</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Timeline scrubber for post-run analysis. Each marker is emitted by the same event bus that powers the live
          simulation — ideal for showing causality between Byzantine faults, relay promotions, and task assignment.
        </p>
      </div>

      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{mission.name}</CardTitle>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              mission.status === "active" ? "bg-success/20 text-success" :
              mission.status === "completed" ? "bg-primary/20 text-primary" :
              "bg-destructive/20 text-destructive"
            }`}>{mission.status}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" onClick={() => setCurrentTime([0])}><SkipBack className="w-4 h-4" /></Button>
            <Button size="icon" variant={playing ? "default" : "outline"} onClick={() => setPlaying(!playing)}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setCurrentTime([100])}><SkipForward className="w-4 h-4" /></Button>
            <div className="flex-1"><Slider value={currentTime} onValueChange={setCurrentTime} min={0} max={100} step={1} /></div>
            <span className="font-mono text-xs text-muted-foreground">{currentTime[0]}%</span>
          </div>

          <div className="relative pl-6 space-y-4">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            {visibleEvents.map((event, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="relative flex items-start gap-4">
                <div className={`absolute left-[-13px] w-3 h-3 rounded-full border-2 ${
                  event.type === "agent_failed" ? "bg-destructive border-destructive" :
                  event.type === "mission_complete" ? "bg-success border-success" :
                  "bg-primary border-primary"
                }`} />
                <div className="flex-1 p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{event.description}</span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground capitalize">{event.type.replace(/_/g, " ")}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
