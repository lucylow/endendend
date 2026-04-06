import { useMissions } from "@/hooks/useMissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success",
  aborted: "bg-destructive/20 text-destructive",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-primary/20 text-primary",
  high: "bg-accent/20 text-accent",
  critical: "bg-destructive/20 text-destructive",
};

export default function MissionList() {
  const { user } = useAuth();
  const { missions, isLoading, updateMission } = useMissions();

  if (!user) return <p className="text-sm text-muted-foreground text-center py-8">Sign in to view missions.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-8">Loading missions…</p>;
  if (missions.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No missions yet. Create one above.</p>;

  return (
    <div className="space-y-3">
      {missions.map((m) => (
        <Card key={m.id} className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-foreground truncate">{m.title}</span>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[m.status] ?? ""}`}>{m.status}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${priorityColors[m.priority ?? "normal"] ?? ""}`}>{m.priority}</Badge>
                </div>
                {m.description && <p className="text-xs text-muted-foreground line-clamp-1">{m.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {m.location && <span>📍 {m.location}</span>}
                  {m.mission_type && <span className="capitalize">{m.mission_type.replace("_", " ")}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {m.status === "draft" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateMission.mutate({ id: m.id, status: "active" })}>
                    <Play className="w-3 h-3" /> Start
                  </Button>
                )}
                {m.status === "active" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateMission.mutate({ id: m.id, status: "completed" })}>
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
