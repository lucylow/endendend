import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSwarmStore } from "@/store/swarmStore";
import { Gavel, Clock, Coins, TrendingUp } from "lucide-react";

export default function AuctionsPage() {
  const { tasks, agents } = useSwarmStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Task auctions</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Stake-weighted, proximity-aware bidding for hazardous work. Tasks enter as open lots; agents submit sealed bids
            that combine $TASHI escrow, battery headroom, and trust scores — settlement paths are stubbed here but map
            cleanly to on-chain receipts.
          </p>
        </div>
        <Button className="glow-cyan gap-2 shrink-0"><Gavel className="w-3 h-3" /> Create task</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tasks.map((task, i) => (
          <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="bg-card/50 border-border card-hover h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={task.priority === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{task.status}</Badge>
                </div>
                <CardTitle className="text-base">{task.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                <p className="text-sm text-muted-foreground">{task.description}</p>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-3 h-3 text-primary" />
                      <span className="font-mono text-sm font-bold text-primary">{task.reward} $TASHI</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-mono">{Math.max(0, Math.floor((task.deadline - Date.now()) / 60000))}m left</span>
                    </div>
                  </div>
                  {task.bids.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="text-[10px] font-mono text-muted-foreground tracking-wider">BIDS ({task.bids.length})</div>
                      {task.bids.map((bid) => {
                        const agent = agents.find((a) => a.id === bid.agentId);
                        return (
                          <div key={bid.agentId} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/50">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-xs text-foreground">{agent?.name || bid.agentId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-primary">{bid.amount}</span>
                              <TrendingUp className="w-3 h-3 text-success" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {task.status === "bidding" || task.status === "open" ? (
                    <Button size="sm" className="w-full" variant={task.status === "bidding" ? "default" : "outline"}>
                      {task.status === "bidding" ? "Place Bid" : "Start Auction"}
                    </Button>
                  ) : (
                    <div className="text-center text-[10px] font-mono text-muted-foreground py-2">
                      {task.assignedAgent ? `Assigned to ${agents.find((a) => a.id === task.assignedAgent)?.name}` : task.status}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
